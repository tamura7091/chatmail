import { EmailMessage, Contact, UserProfile } from '../types';

// IndexedDB database name and version
const DB_NAME = 'chatmail_db';
const DB_VERSION = 1;

// Store names
const STORES = {
  MESSAGES: 'messages',
  CONTACTS: 'contacts',
  USER_PROFILE: 'userProfile',
  DERIVED_DATA: 'derivedData',
  SYNC_INFO: 'syncInfo'
};

// Initialize the database
const initializeDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event);
      reject('Error opening IndexedDB');
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create message store with messageId as key
      if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
        const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        messageStore.createIndex('threadId', 'threadId', { unique: false });
        messageStore.createIndex('internalDate', 'internalDate', { unique: false });
      }
      
      // Create contacts store with email as key
      if (!db.objectStoreNames.contains(STORES.CONTACTS)) {
        const contactStore = db.createObjectStore(STORES.CONTACTS, { keyPath: 'id' });
        contactStore.createIndex('email', 'email', { unique: true });
      }
      
      // Create user profile store
      if (!db.objectStoreNames.contains(STORES.USER_PROFILE)) {
        db.createObjectStore(STORES.USER_PROFILE, { keyPath: 'email' });
      }
      
      // Create derived data store for AI-generated metadata
      if (!db.objectStoreNames.contains(STORES.DERIVED_DATA)) {
        const derivedDataStore = db.createObjectStore(STORES.DERIVED_DATA, { keyPath: 'messageId' });
        derivedDataStore.createIndex('type', 'type', { unique: false });
      }
      
      // Create sync info store
      if (!db.objectStoreNames.contains(STORES.SYNC_INFO)) {
        db.createObjectStore(STORES.SYNC_INFO, { keyPath: 'id' });
      }
    };
  });
};

// Helper function to perform database operations
const withDB = async <T>(
  operation: (db: IDBDatabase) => Promise<T>
): Promise<T> => {
  const db = await initializeDB();
  try {
    return await operation(db);
  } finally {
    db.close();
  }
};

// Store messages in IndexedDB
export const storeMessages = async (messages: EmailMessage[]): Promise<void> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MESSAGES], 'readwrite');
      const store = transaction.objectStore(STORES.MESSAGES);
      
      // Add enhanced properties to messages that need to be persisted
      messages.forEach(message => {
        // Only preserve specific AI-generated properties when storing
        const derivedTransaction = db.transaction([STORES.DERIVED_DATA], 'readwrite');
        const derivedStore = derivedTransaction.objectStore(STORES.DERIVED_DATA);
        
        if (message.isRealHuman !== undefined || message.actionNeeded !== undefined) {
          derivedStore.put({
            messageId: message.id,
            type: 'ai_classification',
            isRealHuman: message.isRealHuman,
            actionNeeded: message.actionNeeded,
            timestamp: Date.now()
          });
        }
        
        // Then store the message in the message store
        const request = store.put(message);
        request.onerror = (event) => {
          console.error('Error storing message:', event);
        };
      });
      
      transaction.oncomplete = () => {
        console.log(`Successfully stored ${messages.length} messages in IndexedDB`);
        resolve();
      };
      
      transaction.onerror = (event) => {
        console.error('Transaction error when storing messages:', event);
        reject('Error storing messages');
      };
    });
  });
};

// Get all messages from IndexedDB
export const getAllMessages = async (): Promise<EmailMessage[]> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.MESSAGES], 'readonly');
      const store = transaction.objectStore(STORES.MESSAGES);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const messages = request.result as EmailMessage[];
        
        // Fetch derived data to enhance messages
        const derivedTransaction = db.transaction([STORES.DERIVED_DATA], 'readonly');
        const derivedStore = derivedTransaction.objectStore(STORES.DERIVED_DATA);
        const derivedRequest = derivedStore.getAll();
        
        derivedRequest.onsuccess = () => {
          const derivedData = derivedRequest.result;
          const derivedDataMap = new Map(
            derivedData.map(item => [item.messageId, item])
          );
          
          // Combine messages with their derived data
          const enhancedMessages = messages.map(message => {
            const derived = derivedDataMap.get(message.id);
            if (derived) {
              return {
                ...message,
                isRealHuman: derived.isRealHuman,
                actionNeeded: derived.actionNeeded
              };
            }
            return message;
          });
          
          resolve(enhancedMessages);
        };
        
        derivedRequest.onerror = (event) => {
          console.error('Error retrieving derived data:', event);
          resolve(messages); // Return messages even if derived data fails
        };
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving messages:', event);
        reject('Error retrieving messages');
      };
    });
  });
};

// Get the timestamp of the most recent message
export const getLastSyncTime = async (): Promise<number> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_INFO], 'readonly');
      const store = transaction.objectStore(STORES.SYNC_INFO);
      const request = store.get('lastSync');
      
      request.onsuccess = () => {
        const lastSync = request.result;
        resolve(lastSync ? lastSync.timestamp : 0);
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving last sync time:', event);
        resolve(0); // Default to 0 if there's an error
      };
    });
  });
};

// Update the last sync time
export const updateLastSyncTime = async (timestamp: number = Date.now()): Promise<void> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_INFO], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_INFO);
      const request = store.put({ id: 'lastSync', timestamp });
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error updating last sync time:', event);
        reject('Error updating last sync time');
      };
    });
  });
};

// Store a contact in IndexedDB
export const storeContact = async (contact: Contact): Promise<void> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONTACTS], 'readwrite');
      const store = transaction.objectStore(STORES.CONTACTS);
      const request = store.put(contact);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error storing contact:', event);
        reject('Error storing contact');
      };
    });
  });
};

// Get a contact by email
export const getContactByEmail = async (email: string): Promise<Contact | null> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONTACTS], 'readonly');
      const store = transaction.objectStore(STORES.CONTACTS);
      const index = store.index('email');
      const request = index.get(email.toLowerCase());
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving contact:', event);
        reject('Error retrieving contact');
      };
    });
  });
};

// Get all contacts
export const getAllContacts = async (): Promise<Contact[]> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONTACTS], 'readonly');
      const store = transaction.objectStore(STORES.CONTACTS);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving contacts:', event);
        reject('Error retrieving contacts');
      };
    });
  });
};

// Store the user profile
export const storeUserProfile = async (profile: UserProfile): Promise<void> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.USER_PROFILE], 'readwrite');
      const store = transaction.objectStore(STORES.USER_PROFILE);
      const request = store.put(profile);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error storing user profile:', event);
        reject('Error storing user profile');
      };
    });
  });
};

// Get the user profile
export const getUserProfile = async (): Promise<UserProfile | null> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.USER_PROFILE], 'readonly');
      const store = transaction.objectStore(STORES.USER_PROFILE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        if (request.result && request.result.length > 0) {
          resolve(request.result[0]);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving user profile:', event);
        reject('Error retrieving user profile');
      };
    });
  });
};

// Store derived data (AI classifications, action needed flags, etc)
export const storeDerivedData = async (
  messageId: string, 
  data: { isRealHuman?: boolean; actionNeeded?: string }
): Promise<void> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.DERIVED_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.DERIVED_DATA);
      
      const item = {
        messageId,
        type: 'ai_classification',
        ...data,
        timestamp: Date.now()
      };
      
      const request = store.put(item);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error storing derived data:', event);
        reject('Error storing derived data');
      };
    });
  });
};

// Get derived data for a message
export const getDerivedData = async (messageId: string): Promise<any | null> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.DERIVED_DATA], 'readonly');
      const store = transaction.objectStore(STORES.DERIVED_DATA);
      const request = store.get(messageId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving derived data:', event);
        reject('Error retrieving derived data');
      };
    });
  });
};

// Clear all data (for logout or reset)
export const clearAllData = async (): Promise<void> => {
  return withDB(async (db) => {
    return new Promise((resolve, reject) => {
      const stores = [STORES.MESSAGES, STORES.CONTACTS, STORES.USER_PROFILE, STORES.DERIVED_DATA, STORES.SYNC_INFO];
      let completed = 0;
      
      stores.forEach(storeName => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) {
            resolve();
          }
        };
        
        request.onerror = (event) => {
          console.error(`Error clearing ${storeName}:`, event);
          reject(`Error clearing ${storeName}`);
        };
      });
    });
  });
}; 