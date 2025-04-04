import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    contactTags,
    createContact,
    updateContact,
    deleteContact,
    createContactTag,
    updateContactTag,
    deleteContactTag,
    addContactToTag,
    removeContactFromTag
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
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [formState, setFormState] = useState({
    name: '',
    primaryEmail: '',
    alternateEmails: [''],
    company: '',
    title: '',
    phone: '',
    notes: '',
    tags: [] as string[]
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
        tags: []
      });
    } else if (isEditing && selectedContact && contacts[selectedContact]) {
      const contact = contacts[selectedContact];
      setFormState({
        name: contact.name || '',
        primaryEmail: contact.primaryEmail || '',
        alternateEmails: contact.alternateEmails.length ? [...contact.alternateEmails] : [''],
        company: contact.company || '',
        title: contact.title || '',
        phone: contact.phone || '',
        notes: contact.notes || '',
        tags: contact.tags
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
  
  // Handle alternate email changes
  const handleAlternateEmailChange = (index: number, value: string) => {
    const newAlternateEmails = [...formState.alternateEmails];
    newAlternateEmails[index] = value;
    
    setFormState(prev => ({
      ...prev,
      alternateEmails: newAlternateEmails
    }));
  };
  
  // Handle adding a new alternate email field
  const addAlternateEmailField = () => {
    setFormState(prev => ({
      ...prev,
      alternateEmails: [...prev.alternateEmails, '']
    }));
  };
  
  // Handle removing an alternate email field
  const removeAlternateEmailField = (index: number) => {
    const newAlternateEmails = [...formState.alternateEmails];
    newAlternateEmails.splice(index, 1);
    
    setFormState(prev => ({
      ...prev,
      alternateEmails: newAlternateEmails
    }));
  };
  
  // Handle tag selection changes
  const handleTagChange = (tagId: string, checked: boolean) => {
    if (checked) {
      // Add the tag
      setFormState(prev => ({
        ...prev,
        tags: [...prev.tags, tagId]
      }));
    } else {
      // Remove the tag
      setFormState(prev => ({
        ...prev,
        tags: prev.tags.filter(id => id !== tagId)
      }));
    }
  };
  
  // Handle contact creation
  const handleCreateContact = () => {
    // Validate form data
    if (!formState.name || !formState.primaryEmail) {
      setError('Name and primary email are required');
      return;
    }
    
    // Filter out empty alternate emails
    const filteredAlternateEmails = formState.alternateEmails.filter(email => email.trim() !== '');
    
    const newContactId = createContact({
      name: formState.name,
      primaryEmail: formState.primaryEmail,
      alternateEmails: filteredAlternateEmails,
      tags: formState.tags,
      company: formState.company || undefined,
      title: formState.title || undefined,
      phone: formState.phone || undefined,
      notes: formState.notes || undefined
    });
    
    if (newContactId) {
      setShowCreateForm(false);
      setSelectedContact(newContactId);
      setError('');
    } else {
      setError('Failed to create contact');
    }
  };
  
  // Handle contact update
  const handleUpdateContact = () => {
    // Validate form data
    if (!formState.name || !formState.primaryEmail) {
      setError('Name and primary email are required');
      return;
    }
    
    if (!selectedContact) {
      setError('No contact selected');
      return;
    }
    
    // Filter out empty alternate emails
    const filteredAlternateEmails = formState.alternateEmails.filter(email => email.trim() !== '');
    
    const success = updateContact(selectedContact, {
      name: formState.name,
      primaryEmail: formState.primaryEmail,
      alternateEmails: filteredAlternateEmails,
      tags: formState.tags,
      company: formState.company || undefined,
      title: formState.title || undefined,
      phone: formState.phone || undefined,
      notes: formState.notes || undefined
    });
    
    if (success) {
      setIsEditing(false);
      setError('');
    } else {
      setError('Failed to update contact');
    }
  };
  
  // Handle contact deletion
  const handleDeleteContact = () => {
    if (!selectedContact) return;
    
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContact(selectedContact);
      setSelectedContact('');
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
  
  // Get people from conversations if they don't already exist in contacts
  const allContactsWithConversationPeople = useMemo(() => {
    const contactEmails = Object.values(contacts).map(contact => contact.primaryEmail);
    
    // Find people from conversations who aren't already in contacts
    const peopleNotInContacts = Object.values(conversations)
      .filter(conv => !contactEmails.includes(conv.person.email))
      .map(conv => ({
        id: `temp-${conv.person.email}`,
        name: conv.person.name || conv.person.email,
        primaryEmail: conv.person.email,
        alternateEmails: [] as string[],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [] as string[],
        company: conv.person.company || '',
        title: conv.person.title || '',
        phone: conv.person.phone || '',
        notes: conv.person.notes || ''
      }));
    
    return [...Object.values(contacts), ...peopleNotInContacts];
  }, [contacts, conversations]);
  
  // Contact Details View
  const ContactDetailsView = () => {
    const contact = selectedContact && contacts[selectedContact] ? contacts[selectedContact] : null;
    const [quickEditName, setQuickEditName] = useState('');
    const [isQuickEditingName, setIsQuickEditingName] = useState(false);
    const [newAlternateEmail, setNewAlternateEmail] = useState('');
    const [showTagSelector, setShowTagSelector] = useState(false);
    
    // Handle name quick edit
    const handleQuickNameEdit = () => {
      if (!contact) return;
      setQuickEditName(contact.name);
      setIsQuickEditingName(true);
    };
    
    // Save name edit
    const saveNameEdit = () => {
      if (!contact || !quickEditName.trim()) return;
      
      updateContact(contact.id, { name: quickEditName });
      setIsQuickEditingName(false);
    };
    
    // Handle adding alternate email
    const handleAddAlternateEmail = () => {
      if (!contact || !newAlternateEmail.trim() || !newAlternateEmail.includes('@')) return;
      
      const updatedEmails = [...contact.alternateEmails, newAlternateEmail];
      updateContact(contact.id, { alternateEmails: updatedEmails });
      setNewAlternateEmail('');
    };
    
    // Handle removing alternate email
    const handleRemoveAlternateEmail = (emailToRemove: string) => {
      if (!contact) return;
      
      const updatedEmails = contact.alternateEmails.filter(email => email !== emailToRemove);
      updateContact(contact.id, { alternateEmails: updatedEmails });
    };
    
    // Handle tag toggle
    const handleTagToggle = (tagId: string) => {
      if (!contact) return;
      
      if (contact.tags.includes(tagId)) {
        // Remove tag
        const updatedTags = contact.tags.filter(id => id !== tagId);
        updateContact(contact.id, { tags: updatedTags });
      } else {
        // Add tag
        const updatedTags = [...contact.tags, tagId];
        updateContact(contact.id, { tags: updatedTags });
      }
    };
    
    // Tag selector component
    const TagSelector = () => (
      <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-white">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Select Tags</h4>
        
        {Object.keys(contactTags).length === 0 ? (
          <div className="text-sm text-gray-500">No tags available. Create one first.</div>
        ) : (
          <div className="space-y-2">
            {Object.values(contactTags).map(tag => (
              <label key={tag.id} className="flex items-center cursor-pointer p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                  checked={contact?.tags.includes(tag.id)}
                  onChange={() => handleTagToggle(tag.id)}
                />
                <span 
                  className="inline-block w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: tag.color }}
                ></span>
                <span className="text-sm text-gray-900">{tag.name}</span>
              </label>
            ))}
          </div>
        )}
        
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setShowTagSelector(false)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Done
          </button>
        </div>
      </div>
    );
    
    if (!contact) {
      // Try to find a temporary contact if it's from conversation people
      const tempContact = allContactsWithConversationPeople.find(c => c.id === selectedContact);
      
      if (tempContact) {
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">{tempContact.name}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    // Create a proper contact from this temporary one
                    const contactId = createContact({
                      name: tempContact.name,
                      primaryEmail: tempContact.primaryEmail,
                      alternateEmails: [],
                      tags: [],
                      company: tempContact.company,
                      title: tempContact.title,
                      phone: tempContact.phone,
                      notes: tempContact.notes
                    });
                    
                    if (contactId) {
                      setSelectedContact(contactId);
                    }
                  }}
                  className="px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors duration-150"
                >
                  Save to Contacts
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Email</h4>
                <p className="mt-1">{tempContact.primaryEmail}</p>
              </div>
              
              {tempContact.company && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Company</h4>
                  <p className="mt-1">{tempContact.company}</p>
                </div>
              )}
              
              {tempContact.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Notes</h4>
                  <p className="mt-1 whitespace-pre-wrap">{tempContact.notes}</p>
                </div>
              )}
            </div>
          </div>
        );
      }
      
      return <div className="text-center p-8 text-gray-500">No contact selected</div>;
    }
    
    return (
      <div className="bg-white rounded-lg shadow-sm p-5">
        <div className="flex justify-between items-center mb-6">
          {isQuickEditingName ? (
            <div className="flex items-center">
              <input
                type="text"
                value={quickEditName}
                onChange={(e) => setQuickEditName(e.target.value)}
                className="text-xl font-semibold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-blue-500 pb-1 bg-transparent"
                autoFocus
              />
              <button
                onClick={saveNameEdit}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <h3 className="text-xl font-semibold text-gray-900">{contact.name}</h3>
              <button
                onClick={handleQuickNameEdit}
                className="ml-2 text-gray-400 hover:text-blue-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors duration-150"
            >
              Edit All
            </button>
            <button
              onClick={handleDeleteContact}
              className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors duration-150"
            >
              Delete
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-500">Primary Email</h4>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-gray-400 hover:text-blue-600"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-800">{contact.primaryEmail}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-500">Alternate Emails</h4>
            </div>
            
            {contact.alternateEmails.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">No alternate emails</p>
            ) : (
              <ul className="mb-3 space-y-1">
                {contact.alternateEmails.map((email, idx) => (
                  <li key={idx} className="flex justify-between items-center text-gray-800 py-1">
                    <span>{email}</span>
                    <button
                      onClick={() => handleRemoveAlternateEmail(email)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            
            <div className="flex items-center mt-2">
              <input
                type="email"
                value={newAlternateEmail}
                onChange={(e) => setNewAlternateEmail(e.target.value)}
                placeholder="Add new email address"
                className="flex-1 text-sm p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleAddAlternateEmail}
                className="px-3 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 transition-colors duration-150"
              >
                Add
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-500">Tags</h4>
              <button
                onClick={() => setShowTagSelector(!showTagSelector)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showTagSelector ? 'Close' : 'Manage Tags'}
              </button>
            </div>
            
            {contact.tags.length === 0 ? (
              <p className="text-sm text-gray-500">No tags assigned</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contact.tags.map(tagId => (
                  contactTags[tagId] ? (
                    <div key={tagId} className="group relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <span 
                        className="inline-block w-2 h-2 rounded-full mr-1" 
                        style={{ backgroundColor: contactTags[tagId].color }}
                      ></span>
                      {contactTags[tagId].name}
                      <button
                        onClick={() => handleTagToggle(tagId)}
                        className="ml-1 opacity-0 group-hover:opacity-100 text-blue-600 hover:text-red-600 transition-opacity duration-150"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : null
                ))}
              </div>
            )}
            
            {showTagSelector && <TagSelector />}
          </div>
          
          {contact.company && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-500">Company</h4>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  Edit
                </button>
              </div>
              <p className="text-gray-800">{contact.company}</p>
            </div>
          )}
          
          {contact.title && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-500">Title</h4>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  Edit
                </button>
              </div>
              <p className="text-gray-800">{contact.title}</p>
            </div>
          )}
          
          {contact.phone && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-500">Phone</h4>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  Edit
                </button>
              </div>
              <p className="text-gray-800">{contact.phone}</p>
            </div>
          )}
          
          {contact.notes && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-500">Notes</h4>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-400 hover:text-blue-600"
                >
                  Edit
                </button>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Contact Edit Form
  const ContactForm = () => (
    <div className="bg-white p-4 rounded-lg">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {showCreateForm ? 'Create New Contact' : 'Edit Contact'}
      </h3>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <form className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formState.name}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="primaryEmail" className="block text-sm font-medium text-gray-700">Primary Email</label>
          <input
            type="email"
            id="primaryEmail"
            name="primaryEmail"
            value={formState.primaryEmail}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700">Alternate Emails</label>
            <button
              type="button"
              onClick={addAlternateEmailField}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              + Add
            </button>
          </div>
          {formState.alternateEmails.map((email, index) => (
            <div key={index} className="mt-1 flex items-center">
              <input
                type="email"
                value={email}
                onChange={(e) => handleAlternateEmailChange(index, e.target.value)}
                className="flex-1 border border-gray-300 rounded-l-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Additional email"
              />
              <button
                type="button"
                onClick={() => removeAlternateEmailField(index)}
                className="bg-gray-100 p-2 rounded-r-md border border-l-0 border-gray-300 text-gray-500 hover:text-red-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company</label>
          <input
            type="text"
            id="company"
            name="company"
            value={formState.company}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formState.title}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formState.phone}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {Object.keys(contactTags).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="space-y-2">
              {Object.values(contactTags).map(tag => (
                <label key={tag.id} className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                    checked={formState.tags.includes(tag.id)}
                    onChange={(e) => handleTagChange(tag.id, e.target.checked)}
                  />
                  <span 
                    className="inline-block w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: tag.color }}
                  ></span>
                  <span className="text-sm text-gray-900">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={formState.notes}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setIsEditing(false);
              setError('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={showCreateForm ? handleCreateContact : handleUpdateContact}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showCreateForm ? 'Create' : 'Update'}
          </button>
        </div>
      </form>
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

  // Effect to listen for navigation changes
  useEffect(() => {
    // When activeNavItem changes, we need to restore the conversation view if it's 'conversations'
    if (activeNavItem === 'conversations' && selectedView !== 'conversation' && selectedView !== 'special_folder' && selectedView !== 'group') {
      // Restore the last conversation if available
      if (Object.keys(conversations).length > 0) {
        const firstPersonEmail = Object.keys(conversations)[0];
        selectPerson(firstPersonEmail);
      } else if (Object.keys(specialFolders).length > 0) {
        // Or select the first special folder
        selectSpecialFolder(Object.keys(specialFolders)[0]);
      }
    }
  }, [activeNavItem]);

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
                    className="flex-1 p-2 pl-3 border border-gray-200 rounded-l-md bg-white text-gray-800 shadow-sm hover:shadow-sm transition-shadow duration-200 ease-in-out placeholder-gray-400 focus:outline-none focus:shadow-md focus:border-gray-300"
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
                  className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 shadow-sm hover:shadow-sm transition-shadow duration-200 ease-in-out placeholder-gray-400 focus:outline-none focus:shadow-md focus:border-gray-300"
                  placeholder="Enter email address"
                  value={newEmailAddress}
                  onChange={(e) => setNewEmailAddress(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="mb-4">
              <label htmlFor="message-content" className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
              <textarea
                id="message-content"
                key="new-message-textarea"
                className="w-full p-4 border border-gray-200 rounded-lg bg-white text-gray-800 resize-none transition-shadow duration-200 ease-in-out placeholder-gray-400 shadow-sm hover:shadow-md focus:outline-none focus:shadow-md focus:border-gray-300"
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                style={{ height: '120px' }}
                required
              />
            </div>
            
            <div className="flex justify-end mt-auto">
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
  const ContactsView = () => {
    // Filter combined contacts based on search query
    const filteredContacts = useMemo(() => {
      if (!searchQuery) {
        return allContactsWithConversationPeople;
      }
      
      const query = searchQuery.toLowerCase();
      return allContactsWithConversationPeople.filter(
        contact => contact.name.toLowerCase().includes(query) || 
                  contact.primaryEmail.toLowerCase().includes(query) ||
                  (contact.alternateEmails && contact.alternateEmails.some(email => email.toLowerCase().includes(query))) ||
                  (contact.company && contact.company.toLowerCase().includes(query))
      );
    }, [searchQuery, allContactsWithConversationPeople]);

    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b bg-white z-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium text-gray-800">Contacts</h2>
            <button
              onClick={() => {
                setSelectedContact('');
                setShowCreateForm(true);
                setIsEditing(false);
                setFormState({
                  name: '',
                  primaryEmail: '',
                  alternateEmails: [''],
                  company: '',
                  title: '',
                  phone: '',
                  notes: '',
                  tags: []
                });
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center transition-colors duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Contact
            </button>
          </div>
          
          <div className="relative">
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
            {isEditing && selectedContact ? (
              <ContactForm />
            ) : showCreateForm ? (
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
  };

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