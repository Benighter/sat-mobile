import { getSupabaseClient } from './client';
import { resolvePrivateStorageReferences } from './storageCompat';
import { getApps } from 'firebase/app';

type RefKind = 'db' | 'collection' | 'document' | 'query';
type Constraint =
  | { kind: 'where'; field: string; operator: string; value: unknown }
  | { kind: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { kind: 'limit'; count: number }
  | { kind: 'startAfter'; snapshot: DocumentSnapshot };

interface CompatRef {
  kind: RefKind;
  path: string;
  id?: string;
  constraints?: Constraint[];
}

interface DocumentRow {
  document_path: string;
  collection_path: string;
  document_id: string;
  church_id: string | null;
  payload: Record<string, unknown>;
}

const PAGE_SIZE = 1_000;
let realtimeSequence = 0;
const collectionReadsInFlight = new Map<string, Promise<DocumentRow[]>>();

const normalizePath = (...parts: unknown[]): string =>
  parts
    .flatMap((part) => String(part && typeof part === 'object' && 'path' in part ? (part as CompatRef).path : part || '').split('/'))
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');

const randomDocumentId = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
};

const getNested = (value: any, dottedPath: string): any =>
  dottedPath.split('.').reduce((current, segment) => current?.[segment], value);

const setNested = (target: Record<string, any>, dottedPath: string, value: unknown): void => {
  const parts = dottedPath.split('.');
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const existing = current[part];
    current[part] = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

const serialize = (value: any): any => {
  if (value === undefined) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && value.__satServerTimestamp === true) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, child]) => [key, serialize(child)])
        .filter(([, child]) => child !== undefined)
    );
  }
  return value;
};

const revive = (value: any): any => {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, revive(child)]));
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return Timestamp.fromDate(new Date(value));
  }
  return value;
};

const comparable = (value: any): any => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return value;
};

const matchesWhere = (payload: Record<string, unknown>, constraint: Extract<Constraint, { kind: 'where' }>): boolean => {
  const actual = comparable(getNested(payload, constraint.field));
  const expected = comparable(constraint.value);
  switch (constraint.operator) {
    case '==': return actual === expected;
    case '!=': return actual !== undefined && actual !== expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'array-contains': return Array.isArray(actual) && actual.includes(expected);
    default: throw new Error(`Unsupported Firestore query operator: ${constraint.operator}`);
  }
};

const refForDocumentPath = (path: string): CompatRef => ({
  kind: 'document',
  path,
  id: path.split('/').pop() || '',
});

export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp { return Timestamp.fromDate(new Date()); }
  static fromDate(date: Date): Timestamp {
    const millis = date.getTime();
    return new Timestamp(Math.floor(millis / 1_000), (millis % 1_000) * 1_000_000);
  }
  static fromMillis(millis: number): Timestamp { return Timestamp.fromDate(new Date(millis)); }
  toDate(): Date { return new Date(this.toMillis()); }
  toMillis(): number { return this.seconds * 1_000 + Math.floor(this.nanoseconds / 1_000_000); }
  valueOf(): number { return this.toMillis(); }
  toJSON(): string { return this.toDate().toISOString(); }
  toString(): string { return this.toDate().toISOString(); }
}

export class DocumentSnapshot<T = Record<string, unknown>> {
  readonly ref: CompatRef;
  readonly id: string;
  readonly metadata = { hasPendingWrites: false, fromCache: false };
  private readonly row: DocumentRow | null;

  constructor(ref: CompatRef, row: DocumentRow | null) {
    this.ref = ref;
    this.id = ref.id || '';
    this.row = row;
  }

  exists(): boolean { return this.row !== null; }
  data(): T | undefined { return this.row ? revive(this.row.payload) as T : undefined; }
}

class QuerySnapshot<T = Record<string, unknown>> {
  readonly docs: DocumentSnapshot<T>[];
  readonly size: number;
  readonly empty: boolean;
  constructor(docs: DocumentSnapshot<T>[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
  forEach(callback: (snapshot: DocumentSnapshot<T>) => void): void { this.docs.forEach(callback); }
}

export const initializeFirestore = (): CompatRef => ({ kind: 'db', path: '' });
export const connectFirestoreEmulator = (): void => undefined;
export const setLogLevel = (): void => undefined;
export const enableNetwork = async (): Promise<void> => undefined;
export const disableNetwork = async (): Promise<void> => undefined;

export const collection = (parent: CompatRef, ...segments: string[]): CompatRef => ({
  kind: 'collection', path: normalizePath(parent, ...segments),
});

export const doc = (parent: CompatRef, ...segments: string[]): CompatRef => {
  const resolved = segments.length === 0 && parent.kind === 'collection'
    ? normalizePath(parent, randomDocumentId())
    : normalizePath(parent, ...segments);
  return refForDocumentPath(resolved);
};

export const where = (field: string, operator: string, value: unknown): Constraint => ({ kind: 'where', field, operator, value });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): Constraint => ({ kind: 'orderBy', field, direction });
export const limit = (count: number): Constraint => ({ kind: 'limit', count });
export const startAfter = (snapshot: DocumentSnapshot): Constraint => ({ kind: 'startAfter', snapshot });
export const query = (base: CompatRef, ...constraints: Constraint[]): CompatRef => ({ kind: 'query', path: base.path, constraints });
export const serverTimestamp = (): { __satServerTimestamp: true } => ({ __satServerTimestamp: true });

const fetchCollectionRowsUncached = async (path: string, constraints: Constraint[] = []): Promise<DocumentRow[]> => {
  const client = getSupabaseClient();
  const rows: DocumentRow[] = [];
  const filters = constraints
    .filter((constraint): constraint is Extract<Constraint, { kind: 'where' }> => constraint.kind === 'where')
    .map((constraint) => ({ field: constraint.field, operator: constraint.operator, value: serialize(constraint.value) }));
  const orders = constraints
    .filter((constraint): constraint is Extract<Constraint, { kind: 'orderBy' }> => constraint.kind === 'orderBy')
    .map((constraint) => ({ field: constraint.field, direction: constraint.direction }));
  const cap = constraints.find((constraint): constraint is Extract<Constraint, { kind: 'limit' }> => constraint.kind === 'limit');
  const cursor = constraints.some((constraint) => constraint.kind === 'startAfter');
  const serverLimit = cap && !cursor ? Math.min(cap.count, 1_000) : null;

  // A bounded query can keep the existing server-side ordering and limit.
  // Unbounded histories use keyset pages, then getDocs applies Firestore order
  // semantics locally after every row has been collected.
  if (serverLimit !== null) {
    const { data, error } = await client.rpc('sat_query_documents', {
      target_collection_path: path,
      filter_spec: filters,
      order_spec: orders,
      row_limit: serverLimit,
    });
    if (error) throw error;
    rows.push(...((data || []) as DocumentRow[]));
  } else {
    let afterDocumentId: string | null = null;
    for (;;) {
      const { data, error } = await client.rpc('sat_query_documents_page', {
        target_collection_path: path,
        filter_spec: filters,
        after_document_id: afterDocumentId,
        page_limit: PAGE_SIZE,
      });
      if (error) throw error;
      const page = (data || []) as DocumentRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      const nextDocumentId = page[page.length - 1]?.document_id;
      if (!nextDocumentId || nextDocumentId === afterDocumentId) {
        throw new Error('Supabase document pagination did not advance');
      }
      afterDocumentId = nextDocumentId;
    }
  }
  return Promise.all(rows.map(async (row) => ({
    ...row,
    payload: await resolvePrivateStorageReferences(row.payload) as Record<string, unknown>,
  })));
};

const fetchCollectionRows = async (path: string, constraints: Constraint[] = []): Promise<DocumentRow[]> => {
  const key = JSON.stringify({ path, constraints: constraints.map((constraint) => {
    if (constraint.kind === 'startAfter') return { kind: constraint.kind, path: constraint.snapshot.ref.path };
    if (constraint.kind === 'where') return { ...constraint, value: serialize(constraint.value) };
    return constraint;
  }) });
  let pending = collectionReadsInFlight.get(key);
  if (!pending) {
    pending = fetchCollectionRowsUncached(path, constraints);
    collectionReadsInFlight.set(key, pending);
    void pending.finally(() => {
      if (collectionReadsInFlight.get(key) === pending) collectionReadsInFlight.delete(key);
    }).catch(() => undefined);
  }
  return [...await pending];
};

export const getDoc = async <T = Record<string, unknown>>(reference: CompatRef): Promise<DocumentSnapshot<T>> => {
  const { data, error } = await getSupabaseClient()
    .from('sat_documents')
    .select('document_path,collection_path,document_id,church_id,payload')
    .eq('document_path', reference.path)
    .maybeSingle();
  if (error) throw error;
  const row = data
    ? { ...(data as DocumentRow), payload: await resolvePrivateStorageReferences((data as DocumentRow).payload) as Record<string, unknown> }
    : null;
  return new DocumentSnapshot<T>(reference, row);
};

export const getDocs = async <T = Record<string, unknown>>(reference: CompatRef): Promise<QuerySnapshot<T>> => {
  const constraints = reference.constraints || [];
  let rows = await fetchCollectionRows(reference.path, constraints);
  for (const constraint of constraints) {
    if (constraint.kind === 'where') rows = rows.filter((row) => matchesWhere(revive(row.payload), constraint));
  }
  const orderConstraints = constraints.filter((constraint): constraint is Extract<Constraint, { kind: 'orderBy' }> => constraint.kind === 'orderBy');
  if (orderConstraints.length > 0) {
    rows.sort((left, right) => {
      for (const order of orderConstraints) {
        const a = comparable(getNested(revive(left.payload), order.field));
        const b = comparable(getNested(revive(right.payload), order.field));
        if (a === b) continue;
        const result = a == null ? -1 : b == null ? 1 : a < b ? -1 : 1;
        return order.direction === 'desc' ? -result : result;
      }
      return left.document_id.localeCompare(right.document_id);
    });
  }
  const cursor = constraints.find((constraint): constraint is Extract<Constraint, { kind: 'startAfter' }> => constraint.kind === 'startAfter');
  if (cursor) {
    const index = rows.findIndex((row) => row.document_path === cursor.snapshot.ref.path);
    if (index >= 0) rows = rows.slice(index + 1);
  }
  const cap = constraints.find((constraint): constraint is Extract<Constraint, { kind: 'limit' }> => constraint.kind === 'limit');
  if (cap) rows = rows.slice(0, cap.count);
  return new QuerySnapshot<T>(rows.map((row) => new DocumentSnapshot<T>(refForDocumentPath(row.document_path), row)));
};

interface BatchOperation {
  kind: 'upsert' | 'delete' | 'create_if_absent';
  document_path: string;
  collection_path?: string;
  document_id?: string;
  church_id?: string | null;
  payload?: Record<string, unknown>;
}

const operationForPayload = (reference: CompatRef, payload: Record<string, unknown>, kind: BatchOperation['kind'] = 'upsert'): BatchOperation => {
  const parts = reference.path.split('/');
  return {
    kind,
    document_path: reference.path,
    collection_path: parts.slice(0, -1).join('/'),
    document_id: reference.id || parts[parts.length - 1],
    church_id: parts[0] === 'churches' ? parts[1] : (typeof payload.churchId === 'string' ? payload.churchId : null),
    payload: serialize(payload),
  };
};

const commitOperations = async (operations: BatchOperation[]): Promise<void> => {
  if (operations.length === 0) return;
  const { data, error } = await getSupabaseClient().rpc('sat_apply_document_batch', { operations });
  if (error) throw error;
  if (data !== operations.length) throw new Error('Supabase document batch reconciliation failed');
  if (import.meta.env.VITE_FIREBASE_ROLLBACK_WRITES !== 'false') {
    const firebase = await import('sat-firebase-firestore-original');
    const app = getApps()[0];
    if (!app) throw new Error('Firebase rollback mirror is unavailable');
    const database = firebase.getFirestore(app);
    for (let offset = 0; offset < operations.length; offset += 500) {
      const batch = firebase.writeBatch(database);
      for (const operation of operations.slice(offset, offset + 500)) {
        const reference = firebase.doc(database, operation.document_path);
        if (operation.kind === 'delete') batch.delete(reference);
        else batch.set(reference, operation.payload || {});
      }
      await batch.commit();
    }
  }
};

export const setDoc = async (reference: CompatRef, value: Record<string, unknown>, options?: { merge?: boolean }): Promise<void> => {
  let payload = serialize(value);
  if (options?.merge) {
    const existing = await getDoc(reference);
    payload = { ...(existing.data() || {}), ...payload };
  }
  await commitOperations([operationForPayload(reference, payload)]);
};

export const updateDoc = async (reference: CompatRef, updates: Record<string, unknown>): Promise<void> => {
  const existing = await getDoc(reference);
  if (!existing.exists()) throw new Error(`Document does not exist: ${reference.path}`);
  const payload = { ...(existing.data() as Record<string, unknown>) };
  for (const [field, value] of Object.entries(updates)) setNested(payload, field, serialize(value));
  await commitOperations([operationForPayload(reference, payload)]);
};

export const addDoc = async (reference: CompatRef, value: Record<string, unknown>): Promise<CompatRef> => {
  const documentReference = doc(reference);
  await setDoc(documentReference, value);
  return documentReference;
};

export const deleteDoc = async (reference: CompatRef): Promise<void> => {
  await commitOperations([{ kind: 'delete', document_path: reference.path }]);
};

export const writeBatch = () => {
  const pending: Array<() => Promise<BatchOperation>> = [];
  const batch = {
    set(reference: CompatRef, value: Record<string, unknown>, options?: { merge?: boolean }) {
      pending.push(async () => {
        if (!options?.merge) return operationForPayload(reference, value);
        const existing = await getDoc(reference);
        return operationForPayload(reference, { ...(existing.data() || {}), ...serialize(value) });
      });
      return batch;
    },
    update(reference: CompatRef, updates: Record<string, unknown>) {
      pending.push(async () => {
        const existing = await getDoc(reference);
        if (!existing.exists()) throw new Error(`Document does not exist: ${reference.path}`);
        const payload = { ...(existing.data() as Record<string, unknown>) };
        for (const [field, value] of Object.entries(updates)) setNested(payload, field, serialize(value));
        return operationForPayload(reference, payload);
      });
      return batch;
    },
    delete(reference: CompatRef) {
      pending.push(async () => ({ kind: 'delete', document_path: reference.path }));
      return batch;
    },
    async commit() { await commitOperations(await Promise.all(pending.map((operation) => operation()))); },
  };
  return batch;
};

export class Transaction {
  readonly operations: BatchOperation[] = [];
  private readonly reads = new Map<string, boolean>();
  async get(reference: CompatRef): Promise<DocumentSnapshot> {
    const snapshot = await getDoc(reference);
    this.reads.set(reference.path, snapshot.exists());
    return snapshot;
  }
  set(reference: CompatRef, value: Record<string, unknown>): Transaction {
    this.operations.push(operationForPayload(reference, value, this.reads.get(reference.path) === false ? 'create_if_absent' : 'upsert'));
    return this;
  }
  update(reference: CompatRef, updates: Record<string, unknown>): Transaction {
    this.operations.push(operationForPayload(reference, updates));
    return this;
  }
  delete(reference: CompatRef): Transaction {
    this.operations.push({ kind: 'delete', document_path: reference.path });
    return this;
  }
}

export const runTransaction = async <T>(_database: CompatRef, callback: (transaction: Transaction) => Promise<T>): Promise<T> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const transaction = new Transaction();
    const result = await callback(transaction);
    try {
      await commitOperations(transaction.operations);
      return result;
    } catch (error: any) {
      if (attempt === 2 || error?.code !== '40001') throw error;
    }
  }
  throw new Error('Transaction retry limit reached');
};

export const onSnapshot = <T = Record<string, unknown>>(
  reference: CompatRef,
  onNext: (snapshot: DocumentSnapshot<T> | QuerySnapshot<T>) => void,
  onError?: (error: unknown) => void
): (() => void) => {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const refresh = async () => {
    try {
      const snapshot = reference.kind === 'document' ? await getDoc<T>(reference) : await getDocs<T>(reference);
      if (active) onNext(snapshot);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };
  void refresh();
  const collectionPath = reference.kind === 'document' ? reference.path.split('/').slice(0, -1).join('/') : reference.path;
  const channel = getSupabaseClient()
    .channel(`sat-documents-${++realtimeSequence}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sat_documents', filter: `collection_path=eq.${collectionPath}` }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 50);
    })
    .subscribe();
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    void getSupabaseClient().removeChannel(channel);
  };
};

export type Unsubscribe = () => void;
