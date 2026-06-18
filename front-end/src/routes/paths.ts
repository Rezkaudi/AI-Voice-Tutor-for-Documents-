export const paths = {
  login: "/login",
  library: "/documents",
  document: (documentId: string) => `/documents/${documentId}`
} as const;

export const LIBRARY_ROUTE = "documents";

export const DOCUMENT_ROUTE = "documents/:documentId";
