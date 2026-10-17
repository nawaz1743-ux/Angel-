/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  X,
  Plus,
  PhoneCall,
  Share2,
  Trash2,
  Search,
  UserPlus,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { ContactItem } from '../types/assistant';
import {
  validatePhoneNumber,
  buildTelUrl,
  buildWhatsAppUrl,
  searchContacts,
} from '../utils/assistant-logic';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: ContactItem[];
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onDeleteContact: (id: string) => void;
  onSelectContact?: (contact: ContactItem) => void;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onAddContact,
  onDeleteContact,
  onSelectContact,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Friend');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = searchQuery ? searchContacts(contacts, searchQuery) : contacts;

  const hasNativeContacts =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window;

  const handleImportNative = async () => {
    if (!hasNativeContacts) {
      alert('Native Contact Picker is supported in Chrome on Android. You can add contacts manually here!');
      return;
    }
    try {
      const results = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
      if (results && results.length > 0) {
        for (const item of results) {
          const contactName = item.name?.[0];
          const tel = item.tel?.[0];
          if (contactName && tel) {
            onAddContact({
              name: contactName,
              phone: tel,
              relation: 'Android Contact',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Native contact import cancelled or failed:', err);
    }
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter a contact name');
      return;
    }
    if (!phone || !validatePhoneNumber(phone)) {
      setErrorMessage('Please enter a valid phone number (at least 7 digits)');
      return;
    }

    onAddContact({
      name: name.trim(),
      phone: phone.trim(),
      relation: relation.trim() || undefined,
    });

    setName('');
    setPhone('');
    setErrorMessage(null);
    setIsAdding(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-violet-500/30 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-bold text-white">Angel Contacts Book</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Contacts"
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 border-b border-white/5 bg-slate-900/60 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, relation or number..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex-1 py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'Cancel' : 'Add Contact'}</span>
            </button>
            <button
              onClick={handleImportNative}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              title="Import from Android Device Address Book"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Import</span>
            </button>
          </div>
        </div>

        {/* Add Contact Form (Collapsible) */}
        {isAdding && (
          <form
            onSubmit={handleSaveContact}
            className="p-3 bg-slate-950 border-b border-white/10 space-y-2 text-left"
          >
            <div className="text-xs font-bold text-violet-300">Add New Contact</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact Name (e.g. Rahul Sharma)"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number (e.g. +91 98765 43210)"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <div className="flex items-center gap-2">
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 flex-1"
              >
                <option value="Friend">Friend</option>
                <option value="Family">Family</option>
                <option value="Work">Work</option>
                <option value="Doctor">Doctor</option>
                <option value="Other">Other</option>
              </select>
              <button
                type="submit"
                className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Save
              </button>
            </div>
            {errorMessage && (
              <p className="text-[10px] text-rose-400">{errorMessage}</p>
            )}
          </form>
        )}

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-white/5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No contacts found matching "{searchQuery}".
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className="pt-2 first:pt-0 flex items-center justify-between gap-2"
              >
                <div
                  onClick={() => {
                    if (onSelectContact) {
                      onSelectContact(c);
                      onClose();
                    }
                  }}
                  className={`flex-1 text-left ${onSelectContact ? 'cursor-pointer' : ''}`}
                >
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>{c.name}</span>
                    {c.relation && (
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">
                        {c.relation}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {c.phone}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <a
                    href={buildTelUrl(c.phone)}
                    title={`Call ${c.name}`}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-violet-600 text-slate-300 hover:text-white transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={buildWhatsAppUrl(c.phone, 'Hello!').appIntent}
                    title={`WhatsApp ${c.name}`}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => onDeleteContact(c.id)}
                    title="Delete Contact"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
