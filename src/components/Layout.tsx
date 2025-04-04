import React, { useState, useEffect, useRef } from 'react';
import { useGmail } from '../context/GmailContext';
import PersonList from './PersonList';
import ChatView from './ChatView';
import Login from './Login';

type NavItem = 'conversations' | 'contacts' | 'settings';

const Layout: React.FC = () => {
  const {
    isLoading,
    isAuthenticated,
    userProfile,
    conversations,
    currentPerson,
    handleSignOut,
    selectPerson,
    specialFolders,
    groups,
    selectedView,
    selectedId,
    selectSpecialFolder,
    selectGroup,
    createNewConversation,
    sendMessage,
    contacts,
    createContact,
    updateContact,
    deleteContact,
    addContactToGroup,
    removeContactFromGroup
  } = useGmail();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [activeNavItem, setActiveNavItem] = useState<NavItem>('conversations');
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isBlastEmail, setIsBlastEmail] = useState(false);
  const [blastEmailAddresses, setBlastEmailAddresses] = useState<string[]>([]);
  const [currentEmailAddress, setCurrentEmailAddress] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  
  // Form states for creating and editing contacts
  const [formState, setFormState] = useState({
    name: '',
    primaryEmail: '',
    alternateEmails: [''],
    company: '',
    title: '',
    phone: '',
    notes: '',
    groups: [] as string[]
  });
  
  // Reset form when changing between add/edit modes
  useEffect(() => {
    if (showCreateForm) {
      setFormState({
        name: '',
        primaryEmail: '',
        alternateEmails: [''],
        company: '',
        title: '',
        phone: '',
        notes: '',
        groups: []
      });
    } else if (isEditing && selectedContact && contacts[selectedContact]) {
      const contact = contacts[selectedContact];
      setFormState({
        name: contact.name,
        primaryEmail: contact.primaryEmail,
        alternateEmails: [...contact.alternateEmails, ''],
        company: contact.company || '',
        title: contact.title || '',
        phone: contact.phone || '',
        notes: contact.notes || '',
        groups: contact.groups
      });
    }
  }, [showCreateForm, isEditing, selectedContact, contacts]);
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle alternate email input changes
  const handleAlternateEmailChange = (index: number, value: string) => {
    const newEmails = [...formState.alternateEmails];
    newEmails[index] = value;
    setFormState(prev => ({
      ...prev,
      alternateEmails: newEmails
    }));
  };
  
  // Add new alternate email field
  const addAlternateEmailField = () => {
    if (formState.alternateEmails[formState.alternateEmails.length - 1].trim() !== '') {
      setFormState(prev => ({
        ...prev,
        alternateEmails: [...prev.alternateEmails, '']
      }));
    }
  };
  
  // Remove alternate email field
  const removeAlternateEmailField = (index: number) => {
    if (formState.alternateEmails.length > 1) {
      const newEmails = formState.alternateEmails.filter((_, i) => i !== index);
      setFormState(prev => ({
        ...prev,
        alternateEmails: newEmails
      }));
    }
  };
  
  // Handle group selection
  const handleGroupChange = (groupId: string, checked: boolean) => {
    if (checked) {
      setFormState(prev => ({
        ...prev,
        groups: [...prev.groups, groupId]
      }));
    } else {
      setFormState(prev => ({
        ...prev,
        groups: prev.groups.filter(id => id !== groupId)
      }));
    }
  };
  
  // Handle contact creation
  const handleCreateContact = () => {
    // Validate form
    if (!formState.name.trim() || !formState.primaryEmail.trim()) {
      alert('Name and primary email are required');
      return;
    }
    
    // Filter out empty alternate emails
    const filteredAlternateEmails = formState.alternateEmails.filter(email => email.trim() !== '');
    
    createContact({
      name: formState.name,
      primaryEmail: formState.primaryEmail,
      alternateEmails: filteredAlternateEmails,
      groups: formState.groups,
      company: formState.company || undefined,
      title: formState.title || undefined,
      phone: formState.phone || undefined,
      notes: formState.notes || undefined
    });
    
    setShowCreateForm(false);
  };
  
  // Handle contact update
  const handleUpdateContact = () => {
    if (!selectedContact) return;
    
    // Validate form
    if (!formState.name.trim() || !formState.primaryEmail.trim()) {
      alert('Name and primary email are required');
      return;
    }
    
    // Filter out empty alternate emails
    const filteredAlternateEmails = formState.alternateEmails.filter(email => email.trim() !== '');
    
    updateContact(selectedContact, {
      name: formState.name,
      primaryEmail: formState.primaryEmail,
      alternateEmails: filteredAlternateEmails,
      groups: formState.groups,
      company: formState.company || undefined,
      title: formState.title || undefined,
      phone: formState.phone || undefined,
      notes: formState.notes || undefined
    });
    
    setIsEditing(false);
  };
  
  // Handle contact deletion
  const handleDeleteContact = () => {
    if (!selectedContact) return;
    
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContact(selectedContact);
      setSelectedContact(null);
      setIsEditing(false);
    }
  };
  
  // Filter contacts based on search query
  const filteredContacts = Object.values(contacts).filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.primaryEmail.toLowerCase().includes(query) ||
      contact.alternateEmails.some(email => email.toLowerCase().includes(query)) ||
      (contact.company && contact.company.toLowerCase().includes(query))
    );
  });
  
  // Contact Details View
  const ContactDetailsView = () => {
    if (!selectedContact || !contacts[selectedContact]) return null;
    
    const contact = contacts[selectedContact];
    
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{contact.name}</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={handleDeleteContact}
              className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Emails</h4>
            <p className="text-gray-900">{contact.primaryEmail} (Primary)</p>
            {contact.alternateEmails.map((email, index) => (
              <p key={index} className="text-gray-900">{email}</p>
            ))}
          </div>
          
          {contact.phone && (
            <div>
              <h4 className="text-sm font-medium text-gray-500">Phone</h4>
              <p className="text-gray-900">{contact.phone}</p>
            </div>
          )}
          
          {(contact.company || contact.title) && (
            <div>
              <h4 className="text-sm font-medium text-gray-500">Company</h4>
              {contact.company && <p className="text-gray-900">{contact.company}</p>}
              {contact.title && <p className="text-gray-700 text-sm">{contact.title}</p>}
            </div>
          )}
          
          {contact.groups.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500">Groups</h4>
              <div className="flex flex-wrap gap-2 mt-1">
                {contact.groups.map(groupId => (
                  groups[groupId] ? (
                    <span key={groupId} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {groups[groupId].name}
                    </span>
                  ) : null
                ))}
              </div>
            </div>
          )}
          
          {contact.notes && (
            <div>
              <h4 className="text-sm font-medium text-gray-500">Notes</h4>
              <p className="text-gray-900 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Contact Edit Form
  const ContactForm = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {showCreateForm ? 'Create Contact' : 'Edit Contact'}
        </h3>
        <button
          onClick={() => {
            setIsEditing(false);
            setShowCreateForm(false);
          }}
          className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formState.name}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          />
        </div>
        
        <div>
          <label htmlFor="primaryEmail" className="block text-sm font-medium text-gray-700">
            Primary Email *
          </label>
          <input
            type="email"
            id="primaryEmail"
            name="primaryEmail"
            value={formState.primaryEmail}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Alternate Emails
          </label>
          {formState.alternateEmails.map((email, index) => (
            <div key={index} className="flex mt-2">
              <input
                type="email"
                value={email}
                onChange={(e) => handleAlternateEmailChange(index, e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Alternate email"
              />
              {index === formState.alternateEmails.length - 1 ? (
                <button
                  type="button"
                  onClick={addAlternateEmailField}
                  className="ml-2 inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => removeAlternateEmailField(index)}
                  className="ml-2 inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700">
              Company
            </label>
            <input
              type="text"
              id="company"
              name="company"
              value={formState.company}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formState.title}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formState.phone}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Groups
          </label>
          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
            {Object.values(groups).length === 0 ? (
              <p className="text-sm text-gray-500">No groups available</p>
            ) : (
              <div className="space-y-2">
                {Object.values(groups).map(group => (
                  <label key={group.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formState.groups.includes(group.id)}
                      onChange={e => handleGroupChange(group.id, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">{group.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={formState.notes}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setShowCreateForm(false);
            }}
            className="mr-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={showCreateForm ? handleCreateContact : handleUpdateContact}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showCreateForm ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  // Effect to listen for the openBlastEmail event from the PersonList component
  useEffect(() => {
    const handleOpenBlastEmail = () => {
      setIsBlastEmail(true);
    };
    
    window.addEventListener('openBlastEmail', handleOpenBlastEmail);
    
    return () => {
      window.removeEventListener('openBlastEmail', handleOpenBlastEmail);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Convert conversations object to array of people for PersonList
  const peopleArray = Object.values(conversations).map(conversation => conversation.person);

  // Get the selected conversation if there's a currentPerson
  const selectedConversation = currentPerson ? conversations[currentPerson] : null;

  // Handle creating a new message
  const handleSendNewMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlastEmail) {
      // For blast emails, check if we have addresses and a message
      if (blastEmailAddresses.length === 0 || !newMessage.trim()) return;
      
      // Send to each recipient
      let allSuccessful = true;
      for (const emailAddress of blastEmailAddresses) {
        const success = await sendMessage(emailAddress, newMessage);
        if (!success) allSuccessful = false;
      }
      
      if (allSuccessful) {
        // Reset the form
        setBlastEmailAddresses([]);
        setNewMessage('');
        setIsBlastEmail(false);
      }
    } else {
      // For single emails
      if (!newEmailAddress.trim() || !newMessage.trim()) return;
      
      const success = await sendMessage(newEmailAddress, newMessage);
      if (success) {
        setNewEmailAddress('');
        setNewMessage('');
      }
    }
  };

  // Handle adding an email to the blast recipients list
  const handleAddBlastRecipient = () => {
    if (!currentEmailAddress.trim() || !currentEmailAddress.includes('@')) return;
    
    setBlastEmailAddresses(prev => [...prev, currentEmailAddress]);
    setCurrentEmailAddress('');
  };
  
  // Handle removing an email from the blast recipients list
  const handleRemoveBlastRecipient = (email: string) => {
    setBlastEmailAddresses(prev => prev.filter(e => e !== email));
  };

  // New conversation compose view
  const NewConversationView = () => {
    const [showContactSelector, setShowContactSelector] = useState(false);
    const [selectedGroupForBlast, setSelectedGroupForBlast] = useState<string | null>(null);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    
    // Filter contacts based on search query
    const filteredContactsForSelector = Object.values(contacts).filter(contact => {
      if (contactSearchQuery === '') return true;
      
      const query = contactSearchQuery.toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        contact.primaryEmail.toLowerCase().includes(query) ||
        contact.alternateEmails.some(email => email.toLowerCase().includes(query))
      );
    });
    
    // Get emails from a group
    const getEmailsFromGroup = (groupId: string): string[] => {
      if (!groups[groupId]) return [];
      return groups[groupId].members.map(member => member.email);
    };
    
    // Add emails from a group
    const addGroupToBlastEmails = (groupId: string) => {
      const groupEmails = getEmailsFromGroup(groupId);
      
      // Add emails that aren't already in the list
      const newEmails = groupEmails.filter(email => 
        !blastEmailAddresses.includes(email)
      );
      
      if (newEmails.length > 0) {
        setBlastEmailAddresses(prev => [...prev, ...newEmails]);
      }
      
      setSelectedGroupForBlast(groupId);
    };
    
    // Contact selector
    const ContactSelector = () => (
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Select Recipients
                  </h3>
                  
                  {/* Groups */}
                  {Object.values(groups).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-500">Groups</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {Object.values(groups).map(group => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => addGroupToBlastEmails(group.id)}
                            className={`py-2 px-3 text-sm border rounded-md text-left flex justify-between items-center ${
                              selectedGroupForBlast === group.id
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <span className="truncate">{group.name}</span>
                            <span className="text-xs text-gray-500">{group.members.length}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Contacts */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500">Contacts</h4>
                      <div className="relative w-1/2">
                        <input
                          type="text"
                          className="block w-full pr-10 pl-3 py-1 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Search contacts"
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                      {filteredContactsForSelector.length === 0 ? (
                        <div className="p-3 text-center text-sm text-gray-500">
                          No contacts found
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-200">
                          {filteredContactsForSelector.map(contact => {
                            const isSelected = blastEmailAddresses.includes(contact.primaryEmail) ||
                              contact.alternateEmails.some(email => blastEmailAddresses.includes(email));
                              
                            return (
                              <li 
                                key={contact.id}
                                className={`p-3 flex items-center hover:bg-gray-50 cursor-pointer ${
                                  isSelected ? 'bg-blue-50' : ''
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    // Remove all emails from this contact
                                    const allContactEmails = [contact.primaryEmail, ...contact.alternateEmails];
                                    setBlastEmailAddresses(prev => 
                                      prev.filter(email => !allContactEmails.includes(email))
                                    );
                                  } else {
                                    // Add primary email
                                    if (!blastEmailAddresses.includes(contact.primaryEmail)) {
                                      setBlastEmailAddresses(prev => [...prev, contact.primaryEmail]);
                                    }
                                  }
                                }}
                              >
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-3">
                                  {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{contact.primaryEmail}</p>
                                </div>
                                <div>
                                  {isSelected ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => setShowContactSelector(false)}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlastEmailAddresses([]);
                  setSelectedGroupForBlast(null);
                  setContactSearchQuery('');
                }}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-white z-10">
          <div className="flex justify-between items-center">
            <h2 className="font-medium text-lg text-gray-800">
              {isBlastEmail ? 'New Blast Email' : 'New Conversation'}
            </h2>
            
            {/* Toggle between single and blast email */}
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setIsBlastEmail(false)}
                className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                  !isBlastEmail 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setIsBlastEmail(true)}
                className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                  isBlastEmail 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Blast
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-4">
          <form onSubmit={handleSendNewMessage} className="h-full flex flex-col">
            {isBlastEmail ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">To Multiple Recipients:</label>
                <div className="flex items-center mb-2">
                  <input
                    type="email"
                    className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                    value={currentEmailAddress}
                    onChange={(e) => setCurrentEmailAddress(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddBlastRecipient}
                    className="px-4 py-2 border border-transparent rounded-none shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowContactSelector(true)}
                    className="px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                </div>
                
                {/* Display list of recipients */}
                <div className="border border-gray-200 rounded-md p-2 bg-gray-50 max-h-32 overflow-y-auto">
                  {blastEmailAddresses.length === 0 ? (
                    <p className="text-sm text-gray-500">No recipients added</p>
                  ) : (
                    <ul className="space-y-1">
                      {blastEmailAddresses.map(email => {
                        // Find contact for this email
                        const contact = Object.values(contacts).find(c => 
                          c.primaryEmail === email || c.alternateEmails.includes(email)
                        );
                        
                        return (
                          <li key={email} className="flex justify-between items-center px-2 py-1 text-sm bg-white rounded">
                            <div className="flex items-center">
                              {contact && (
                                <span className="mr-2 text-xs text-gray-500">{contact.name}:</span>
                              )}
                              <span>{email}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveBlastRecipient(email)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 mt-1">
                  Your message will be sent to {blastEmailAddresses.length} recipient{blastEmailAddresses.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                <input
                  type="email"
                  id="email"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                  value={newEmailAddress}
                  onChange={(e) => setNewEmailAddress(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="flex-1 mb-4">
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
              <textarea
                id="message"
                className="w-full h-full p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                required
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setIsBlastEmail(false);
                  selectPerson(Object.keys(conversations)[0] || '');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Send
              </button>
            </div>
          </form>
        </div>
        
        {showContactSelector && <ContactSelector />}
      </div>
    );
  };

  // Bottom Navigation Bar component
  const BottomNavBar = () => (
    <div className="bg-white border-t border-gray-200">
      <div className="flex justify-around py-3">
        <button 
          className={`flex-1 flex flex-col items-center justify-center ${activeNavItem === 'conversations' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveNavItem('conversations')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-xs mt-1">Chats</span>
        </button>
        
        <button 
          className={`flex-1 flex flex-col items-center justify-center ${activeNavItem === 'contacts' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveNavItem('contacts')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1">Contacts</span>
        </button>
        
        <button 
          className={`flex-1 flex flex-col items-center justify-center ${activeNavItem === 'settings' ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveNavItem('settings')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1">Settings</span>
        </button>
      </div>
    </div>
  );

  // ContactsView component with enhanced functionality
  const ContactsView = () => (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b bg-white z-10 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Contacts</h2>
        <button
          onClick={() => {
            setSelectedContact(null);
            setIsEditing(false);
            setShowCreateForm(true);
          }}
          className="p-2 text-blue-600 hover:text-blue-800 focus:outline-none"
          aria-label="Create new contact"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      
      <div className="px-4 py-2 border-b">
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search contacts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Contacts List */}
        <div className={`${selectedContact || isEditing || showCreateForm ? 'hidden md:block md:w-1/3 border-r' : 'w-full'} overflow-y-auto`}>
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredContacts.map(contact => (
                <li 
                  key={contact.id} 
                  className={`cursor-pointer ${selectedContact === contact.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    setSelectedContact(contact.id);
                    setIsEditing(false);
                    setShowCreateForm(false);
                  }}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.primaryEmail}</p>
                        {contact.company && (
                          <p className="text-xs text-gray-500">{contact.company}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Contact Details or Edit Form */}
        <div className={`${selectedContact || isEditing || showCreateForm ? 'w-full md:w-2/3' : 'hidden'} overflow-y-auto p-4 bg-gray-50`}>
          {isEditing || showCreateForm ? (
            <ContactForm />
          ) : selectedContact ? (
            <ContactDetailsView />
          ) : (
            <div className="text-center p-8 text-gray-500">
              Select a contact to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // SettingsView component (simplified for now)
  const SettingsView = () => (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b bg-white z-10">
        <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Account</h3>
            {userProfile && (
              <div className="mt-2 flex items-center">
                {userProfile.picture ? (
                  <img src={userProfile.picture} alt={userProfile.name} className="h-12 w-12 rounded-full" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{userProfile.name}</p>
                  <p className="text-sm text-gray-500">{userProfile.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="mt-4 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900">Appearance</h3>
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input type="checkbox" className="rounded text-blue-500" />
                <span className="ml-2 text-sm text-gray-700">Dark Mode</span>
              </label>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input type="checkbox" className="rounded text-blue-500" defaultChecked />
                <span className="ml-2 text-sm text-gray-700">Email Notifications</span>
              </label>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900">About</h3>
            <p className="mt-2 text-sm text-gray-500">ChatMail v1.0.0</p>
            <p className="text-sm text-gray-500">A better way to manage your emails</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b z-10">
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">ChatMail</h1>
          </div>
          
          {userProfile && activeNavItem !== 'settings' && (
            <div className="flex items-center">
              {userProfile.picture && (
                <img
                  src={userProfile.picture}
                  alt={userProfile.name}
                  className="h-8 w-8 rounded-full mr-2"
                />
              )}
              <span className="text-sm text-gray-700">{userProfile.email}</span>
            </div>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar - maintain consistent width with max-width for all views */}
        <div className="w-1/3 max-w-md min-w-[300px] border-r border-gray-200">
          <PersonList
            people={peopleArray}
            currentPerson={currentPerson}
            onSelectPerson={selectPerson}
            specialFolders={specialFolders}
            groups={groups}
            selectedView={selectedView}
            selectedId={selectedId}
            onSelectSpecialFolder={selectSpecialFolder}
            onSelectGroup={selectGroup}
            onCreateNewChat={createNewConversation}
            activeNavItem={activeNavItem}
            onChangeNavItem={setActiveNavItem}
          />
        </div>
        
        {/* Content Area */}
        <div className="flex-1">
          {activeNavItem === 'conversations' && (
            selectedView === 'conversation' && selectedId === null && !currentPerson ? (
              <NewConversationView />
            ) : (
              <ChatView
                messages={selectedConversation?.messages || []}
                currentPerson={selectedConversation?.person || null}
                userEmail={userProfile?.email || ''}
                selectedView={selectedView}
                selectedId={selectedId}
                specialFolders={specialFolders}
                groups={groups}
              />
            )
          )}
          
          {activeNavItem === 'contacts' && <ContactsView />}
          {activeNavItem === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
};

export default Layout; 