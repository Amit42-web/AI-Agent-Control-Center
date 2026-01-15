import { useState, useEffect } from 'react';

export interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export function useSaveLoadTemplates(storageKey: string) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [useDatabase, setUseDatabase] = useState(true);

  // Load templates from database or localStorage on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        // Try loading from database first
        const response = await fetch(`/api/templates?storageKey=${encodeURIComponent(storageKey)}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setTemplates(data);
            console.log(`Loaded ${data.length} templates from database for ${storageKey}`);
            return;
          }
        }
        // If database fails, fall back to localStorage
        throw new Error('Database not available');
      } catch (error) {
        console.warn('Database unavailable, using localStorage fallback:', error);
        setUseDatabase(false);

        // Fall back to localStorage
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setTemplates(parsed);
            console.log(`Loaded ${parsed.length} templates from localStorage for ${storageKey}`);
          } catch (parseError) {
            console.error('Failed to load templates from localStorage:', parseError);
            setTemplates([]);
          }
        }
      }
    }

    loadTemplates();
  }, [storageKey]);

  // Save to localStorage as backup when templates change
  useEffect(() => {
    if (templates.length >= 0) {
      localStorage.setItem(storageKey, JSON.stringify(templates));
    }
  }, [templates, storageKey]);

  const saveTemplate = async (name: string, content: string) => {
    const newTemplate: Template = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      content,
      createdAt: new Date().toISOString(),
    };

    if (useDatabase) {
      try {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newTemplate.id,
            storageKey,
            name,
            content,
          }),
        });

        if (response.ok) {
          console.log(`Saved template "${name}" to database`);
          setTemplates((prev) => [...prev, newTemplate]);
          return newTemplate;
        } else {
          throw new Error('Failed to save to database');
        }
      } catch (error) {
        console.error('Error saving to database, using localStorage:', error);
        setUseDatabase(false);
      }
    }

    // Fallback to localStorage
    setTemplates((prev) => [...prev, newTemplate]);
    return newTemplate;
  };

  const deleteTemplate = async (id: string) => {
    if (useDatabase) {
      try {
        const response = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          console.log(`Deleted template ${id} from database`);
          setTemplates((prev) => prev.filter((t) => t.id !== id));
          return;
        } else {
          throw new Error('Failed to delete from database');
        }
      } catch (error) {
        console.error('Error deleting from database, using localStorage:', error);
        setUseDatabase(false);
      }
    }

    // Fallback to localStorage
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const loadTemplate = (id: string): string | null => {
    const template = templates.find((t) => t.id === id);
    return template ? template.content : null;
  };

  return {
    templates,
    saveTemplate,
    deleteTemplate,
    loadTemplate,
  };
}
