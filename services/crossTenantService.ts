import {
	addDoc,
	collection,
	doc,
	getDoc,
	getDocs,
	query,
	updateDoc,
	where
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { CrossTenantInvite, CrossTenantAccessLink, CrossTenantPermission } from '../types';

// Collections (root-level)
const INVITES_COLLECTION = 'crossTenantInvites';
const ACCESS_LINKS_COLLECTION = 'crossTenantAccessLinks';

export const crossTenantService = {
	// Send an invite from requester (viewer) to target (owner)
	async sendInvite(params: {
		fromAdminUid: string;
		fromAdminName: string;
		fromChurchId: string;
		fromChurchName?: string;
		toAdminUid: string;
		toAdminEmail: string;
		toAdminName?: string;
		permission?: CrossTenantPermission;
	}): Promise<CrossTenantInvite> {
		const now = new Date().toISOString();
		const payload = {
			fromAdminUid: params.fromAdminUid,
			fromAdminName: params.fromAdminName,
			fromChurchId: params.fromChurchId,
			fromChurchName: params.fromChurchName || undefined,
			toAdminUid: params.toAdminUid,
			toAdminEmail: params.toAdminEmail.toLowerCase(),
			toAdminName: params.toAdminName || undefined,
			permission: params.permission || 'read-write',
			status: 'pending' as const,
			createdAt: now
		};
		const ref = await addDoc(collection(db, INVITES_COLLECTION), payload);
		return { id: ref.id, ...(payload as any) } as CrossTenantInvite;
	},

	// List invites sent to a user
	async getIncomingInvites(toAdminUid: string): Promise<CrossTenantInvite[]> {
		const q = query(collection(db, INVITES_COLLECTION), where('toAdminUid', '==', toAdminUid), where('status', '==', 'pending'));
		const snap = await getDocs(q);
		const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as CrossTenantInvite[];
		// Sort newest first
		items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
		return items;
	},

	// List invites a user sent
	async getOutgoingInvites(fromAdminUid: string): Promise<CrossTenantInvite[]> {
		const q = query(collection(db, INVITES_COLLECTION), where('fromAdminUid', '==', fromAdminUid), where('status', '==', 'pending'));
		const snap = await getDocs(q);
		const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as CrossTenantInvite[];
		items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
		return items;
	},

	async cancelInvite(inviteId: string): Promise<void> {
		await updateDoc(doc(db, INVITES_COLLECTION, inviteId), { status: 'cancelled', respondedAt: new Date().toISOString() });
	},

	// Accept an invite, creating an access link from viewer (fromAdminUid) to owner (toAdminUid)
	async acceptInvite(inviteId: string): Promise<{ link: CrossTenantAccessLink } | { error: string }> {
		const inviteSnap = await getDoc(doc(db, INVITES_COLLECTION, inviteId));
		if (!inviteSnap.exists()) return { error: 'Invite not found' };
		const invite = { id: inviteSnap.id, ...(inviteSnap.data() as any) } as CrossTenantInvite;
		if (invite.status !== 'pending') return { error: 'Invite already processed' };

		// Create or upsert access link
		const linkPayload: Omit<CrossTenantAccessLink, 'id'> = {
			viewerUid: invite.fromAdminUid,
			ownerUid: invite.toAdminUid,
			ownerName: invite.toAdminName || undefined,
			ownerChurchId: invite.fromChurchId /* swapped? ensure owner=toAdmin related to their church */,
			ownerChurchName: invite.fromChurchName,
			permission: invite.permission,
			createdAt: new Date().toISOString()
		} as any;

		// Note: ownerChurchId should be the target admin's church. If invite stored requester's church, fetch owner's profile for accuracy
		try {
			const ownerUserDoc = await getDoc(doc(db, 'users', invite.toAdminUid));
			const odata: any = ownerUserDoc.exists() ? ownerUserDoc.data() : null;
			if (odata?.churchId) {
				(linkPayload as any).ownerChurchId = odata.churchId;
				(linkPayload as any).ownerChurchName = odata.churchName || linkPayload.ownerChurchName;
			}
		} catch {}

		const linkRef = await addDoc(collection(db, ACCESS_LINKS_COLLECTION), linkPayload as any);

		await updateDoc(doc(db, INVITES_COLLECTION, inviteId), { status: 'accepted', respondedAt: new Date().toISOString() });
		return { link: { id: linkRef.id, ...(linkPayload as any) } };
	},

	async rejectInvite(inviteId: string): Promise<void> {
		await updateDoc(doc(db, INVITES_COLLECTION, inviteId), { status: 'rejected', respondedAt: new Date().toISOString() });
	},

	// List churches current admin can switch into (access links)
	async getAccessibleChurchLinks(viewerUid: string): Promise<CrossTenantAccessLink[]> {
		// Note: Some docs may not have an explicit `revoked` field; treat missing as active (not revoked)
		const q = query(collection(db, ACCESS_LINKS_COLLECTION), where('viewerUid', '==', viewerUid));
		const snap = await getDocs(q);
		let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as CrossTenantAccessLink[];
		items = items.filter(i => !i.revoked);
		items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
		return items;
	},

	async revokeAccess(linkId: string): Promise<void> {
		await updateDoc(doc(db, ACCESS_LINKS_COLLECTION, linkId), { revoked: true, revokedAt: new Date().toISOString() });
	},

	// Update permission on an existing access link (e.g., upgrade to read-write)
	async updateAccessPermission(linkId: string, permission: CrossTenantPermission): Promise<void> {
		await updateDoc(doc(db, ACCESS_LINKS_COLLECTION, linkId), { permission });
	}
};

export default crossTenantService;
