export interface CommitFile {
  filename: string;
  previous_filename?: string;
  status: string;
}

export interface CommitDetails {
  sha: string;
  files: CommitFile[];
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  committer: {
    login: string;
    avatar_url: string;
  } | null;
}
