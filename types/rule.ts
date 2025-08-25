export interface Rule {
  guid: string;
  title: string;
  uri: string;
  excerpt?: string;
  htmlAst?: any;
  authors?: Array<{ title: string }>;
}
