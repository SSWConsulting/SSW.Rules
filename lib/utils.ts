import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractCoAuthor(commitMessage) {
  // Regex pour matcher "Co-authored-by: Name <email>"
  const coAuthorRegex = /Co-authored-by:\s*([^<]+)\s*<([^>]+)>/i;
  const match = commitMessage.match(coAuthorRegex);
  
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim()
    };
  }
  
  return null;
}