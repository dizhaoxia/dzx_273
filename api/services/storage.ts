import crypto from 'node:crypto';

export interface UserInfo {
  id: string;
  name: string;
  color: string;
}

export interface DocumentSnapshot {
  id: string;
  name: string;
  snapshot: Buffer;
  updatedAt: Date;
}

interface InMemoryDocSession {
  users: Map<string, UserInfo>;
  snapshot?: DocumentSnapshot;
}

class InMemoryStorage {
  private sessions = new Map<string, InMemoryDocSession>();
  private documents = new Map<string, DocumentSnapshot>();

  async connect(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {}

  async addUser(docId: string, user: UserInfo): Promise<void> {
    if (!this.sessions.has(docId)) {
      this.sessions.set(docId, { users: new Map() });
    }
    this.sessions.get(docId)!.users.set(user.id, user);
  }

  async removeUser(docId: string, userId: string): Promise<void> {
    const session = this.sessions.get(docId);
    if (session) {
      session.users.delete(userId);
    }
  }

  async getUsers(docId: string): Promise<UserInfo[]> {
    const session = this.sessions.get(docId);
    return session ? Array.from(session.users.values()) : [];
  }

  async getUserCount(docId: string): Promise<number> {
    const session = this.sessions.get(docId);
    return session ? session.users.size : 0;
  }

  async createDocument(name?: string): Promise<{ id: string; name: string }> {
    const id = crypto.randomUUID();
    const docName = name || 'Untitled Spreadsheet';
    const snapshot: DocumentSnapshot = {
      id,
      name: docName,
      snapshot: Buffer.from([]),
      updatedAt: new Date(),
    };
    this.documents.set(id, snapshot);
    return { id, name: docName };
  }

  async getDocument(id: string): Promise<DocumentSnapshot | null> {
    return this.documents.get(id) || null;
  }

  async saveSnapshot(docId: string, snapshot: Buffer, docName?: string): Promise<void> {
    const existing = this.documents.get(docId);
    this.documents.set(docId, {
      id: docId,
      name: docName || existing?.name || 'Untitled Spreadsheet',
      snapshot,
      updatedAt: new Date(),
    });
  }

  async updateHeartbeat(_docId: string, _userId: string): Promise<void> {}
}

export const storage = new InMemoryStorage();
export default storage;
