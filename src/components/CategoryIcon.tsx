import React from 'react';
import * as Icons from 'lucide-react';
import { LucideProps } from 'lucide-react';

export const PREDEFINED_ICONS = [
  'Home', 'ShoppingCart', 'Wrench', 'Settings', 'Calendar', 'Lock',
  'Info', 'Star', 'Utensils', 'Car', 'Plus', 'GraduationCap',
  'PawPrint', 'Plane', 'CreditCard', 'Zap', 'Droplet', 'Radio',
  'Shield', 'Dumbbell', 'Wallet', 'Landmark', 'Briefcase', 'Truck',
  'Folder', 'Smartphone', 'LayoutGrid', 'HeartPulse', 'Camera', 'Book'
];

export const PREDEFINED_COLORS = [
  '#059669', // Emerald
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#0F766E', // Teal
  '#F97316'  // Orange
];

interface CategoryIconProps extends LucideProps {
  iconName: string;
}

const toPascalCase = (str: string) => {
  return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

export function CategoryIcon({ iconName, ...props }: CategoryIconProps) {
  let name = iconName;
  // If it's all lowercase or contains dash, it's likely the old kebab-case format
  if (name && (name.includes('-') || name.toLowerCase() === name)) {
    name = toPascalCase(name);
  }
  
  const IconComponent = (Icons as any)[name] || Icons.Folder;
  return <IconComponent {...props} />;
}
