export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: EmailPayload;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

export interface EmailPayload {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers: EmailHeader[];
  body?: EmailBody;
  parts?: EmailPart[];
}

export interface EmailHeader {
  name: string;
  value: string;
}

export interface EmailBody {
  size: number;
  data?: string;
  attachmentId?: string;
}

export interface EmailPart {
  partId: string;
  mimeType: string;
  filename?: string;
  headers: EmailHeader[];
  body: EmailBody;
  parts?: EmailPart[];
}

export interface Person {
  email: string;
  name?: string;
  lastMessageDate: string;
  lastMessageSnippet: string;
  unreadCount: number;
  status?: string;
  action?: string;
  contactId?: string;
  alternateEmails?: string[];
  groups?: string[];
  phone?: string;
  notes?: string;
  company?: string;
  title?: string;
}

export interface Contact {
  id: string;
  name: string;
  primaryEmail: string;
  alternateEmails: string[];
  groups: string[];
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  person: Person;
  messages: EmailMessage[];
}

export interface SpecialFolder {
  id: string;
  name: string;
  type: 'others' | 'reply_needed' | 'normal';
  lastMessageDate: string;
  lastMessageSnippet: string;
  unreadCount: number;
}

export interface GroupMember {
  email: string;
  name?: string;
  role?: string;
  contactId?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
  conversations: Record<string, EmailMessage[]>;
  lastMessageDate: string;
  lastMessageSnippet: string;
  unreadCount: number;
  color?: string;
  icon?: string;
}

export interface UserProfile {
  email: string;
  name: string;
  picture?: string;
} 