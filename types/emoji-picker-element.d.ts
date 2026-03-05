declare namespace JSX {
  interface IntrinsicElements {
    'emoji-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      // Allow setting attributes without type complaints
      [key: string]: any;
    };
  }
}

