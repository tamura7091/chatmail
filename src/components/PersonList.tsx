import React, { useState, useRef, useEffect } from 'react';
import { Person, SpecialFolder, Group } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useGmail } from '../context/GmailContext';

interface PersonListProps {
  people: Person[];
  currentPerson: string | null;
  onSelectPerson: (email: string) => void;
  specialFolders: Record<string, SpecialFolder>;
  groups: Record<string, Group>;
  selectedView: 'conversation' | 'special_folder' | 'group';
  selectedId: string | null;
  onSelectSpecialFolder: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onCreateNewChat: () => void;
  activeNavItem: 'conversations' | 'contacts' | 'settings';
  onChangeNavItem: (item: 'conversations' | 'contacts' | 'settings') => void;
}

const PersonList: React.FC<PersonListProps> = ({ 
  people, 
  currentPerson, 
  onSelectPerson,
  specialFolders,
  groups,
  selectedView,
  selectedId,
  onSelectSpecialFolder,
  onSelectGroup,
  onCreateNewChat,
  activeNavItem,
  onChangeNavItem
}) => {
  const [activeTab, setActiveTab] = useState<'conversations' | 'groups'>('conversations');
  const [showNewOptions, setShowNewOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNewOptions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sort people by most recent message date
  const sortedPeople = [...people].sort((a, b) => {
    const dateA = new Date(a.lastMessageDate);
    const dateB = new Date(b.lastMessageDate);
    return dateB.getTime() - dateA.getTime();
  });

  // Format date to relative time (e.g., "2 hours ago")
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  // Get more specific action text based on general action
  const getSpecificActionText = (action: string) => {
    if (action.includes("Urgent")) {
      return "Send invoice payment ASAP";
    }
    if (action.includes("Reply")) {
      return "Respond to meeting proposal";
    }
    if (action.includes("Task")) {
      return "Complete requested document";
    }
    if (action.includes("Review")) {
      return "Review attached contract";
    }
    if (action.includes("Waiting")) {
      return "Follow up after 3 days";
    }
    return "Send the payout form";
  };

  // Function to get action icon based on action text
  const getActionIcon = (action: string) => {
    if (action.includes("Urgent")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (action.includes("Reply")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      );
    }
    if (action.includes("Task")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    }
    if (action.includes("Review")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    }
    if (action.includes("Waiting")) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    }
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-gray-900">
            {activeTab === 'conversations' ? 'Conversations' : 'Groups'}
          </h2>
          {activeTab === 'conversations' && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNewOptions(!showNewOptions)}
                className="p-2 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-50 focus:outline-none focus:bg-blue-100 transition duration-150"
                aria-label="Create new conversation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              
              {showNewOptions && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg z-10 border border-gray-100 overflow-hidden">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onCreateNewChat();
                        setShowNewOptions(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <div className="bg-blue-100 rounded-full p-2 mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">New Conversation</p>
                          <p className="text-xs text-gray-500">Start a one-on-one conversation</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        onCreateNewChat();
                        // This will be handled by the Layout component
                        // which will detect the isBlastEmail flag is set to true
                        window.dispatchEvent(new CustomEvent('openBlastEmail'));
                        setShowNewOptions(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <div className="bg-purple-100 rounded-full p-2 mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">New Blast Email</p>
                          <p className="text-xs text-gray-500">Send a message to multiple people</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="bg-gray-100 p-0.5 rounded-lg flex">
            <button 
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition duration-150 ${activeTab === 'conversations' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('conversations')}
            >
              Conversations
            </button>
            <button 
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition duration-150 ${activeTab === 'groups' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('groups')}
            >
              Groups
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conversations' ? (
          <div>
            {/* Special Folders */}
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100">
              FOLDERS
            </div>
            <ul>
              {Object.values(specialFolders).map((folder) => (
                <li 
                  key={folder.id}
                  className={`border-b border-gray-100 cursor-pointer transition duration-150 ${
                    selectedView === 'special_folder' && selectedId === folder.id
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSelectSpecialFolder(folder.id)}
                >
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-gray-900 flex items-center">
                        {folder.id === 'others' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        ) : folder.id === 'reply_needed' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        )}
                        {folder.name}
                      </div>
                      {folder.unreadCount > 0 && (
                        <div className="text-xs ml-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {folder.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-500 mt-1 truncate ml-6">
                      {folder.lastMessageSnippet}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Conversations */}
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100">
              PEOPLE
            </div>
            {sortedPeople.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No conversations found
              </div>
            ) : (
              <ul>
                {sortedPeople.map((person) => (
                  <li 
                    key={person.email}
                    className={`border-b border-gray-100 cursor-pointer transition duration-150 ${
                      selectedView === 'conversation' && selectedId === person.email
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onSelectPerson(person.email)}
                  >
                    <div className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-gray-900 truncate flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white mr-2 shadow-sm">
                            {person.name ? person.name.charAt(0).toUpperCase() : person.email.charAt(0).toUpperCase()}
                          </div>
                          <span>{person.name || person.email}</span>
                        </div>
                        <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                          {formatDate(person.lastMessageDate)}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 mt-1 truncate ml-10">
                        {person.lastMessageSnippet}
                      </div>
                      
                      {/* Status badges */}
                      <div className="flex justify-between items-center mt-2 ml-10">
                        {person.status && (
                          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {person.status}
                          </div>
                        )}
                        
                        {person.unreadCount > 0 && (
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shadow-sm">
                            {person.unreadCount}
                          </div>
                        )}
                      </div>
                      
                      {/* Action row (separate) */}
                      {person.action && (
                        <div className="mt-2 text-xs border-t border-gray-100 pt-2 ml-10">
                          <div className="flex items-center text-amber-700 font-medium">
                            {getActionIcon(person.action)}
                            <span>Action needed: {getSpecificActionText(person.action)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            {/* Groups */}
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100">
              GROUPS
            </div>
            {Object.values(groups).length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No groups found
              </div>
            ) : (
              <ul>
                {Object.values(groups).map((group) => (
                  <li 
                    key={group.id}
                    className={`border-b border-gray-100 cursor-pointer transition duration-150 ${
                      selectedView === 'group' && selectedId === group.id
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <div className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-gray-900 truncate flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-white mr-2 shadow-sm">
                            {group.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{group.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                          {formatDate(group.lastMessageDate)}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500 mt-1 truncate ml-10">
                        {group.lastMessageSnippet}
                      </div>
                      
                      <div className="flex items-center mt-2 ml-10 text-xs text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>{group.members.length} members</span>
                        {group.unreadCount > 0 && (
                          <div className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shadow-sm">
                            {group.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar (inside the sidebar) */}
      <div className="mt-auto bg-white border-t border-gray-200 px-2">
        <div className="flex justify-around py-3">
          <button 
            className={`flex-1 flex flex-col items-center justify-center rounded-md py-2 transition duration-150 ${
              activeNavItem === 'conversations' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => onChangeNavItem('conversations')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-xs mt-1">Chats</span>
          </button>
          
          <button 
            className={`flex-1 flex flex-col items-center justify-center rounded-md py-2 transition duration-150 ${
              activeNavItem === 'contacts' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => onChangeNavItem('contacts')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs mt-1">Contacts</span>
          </button>
          
          <button 
            className={`flex-1 flex flex-col items-center justify-center rounded-md py-2 transition duration-150 ${
              activeNavItem === 'settings' 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => onChangeNavItem('settings')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-1">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonList; 