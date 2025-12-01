import React from "react";
import { User } from "lucide-react";

interface ClickableUsernameProps {
  username: string;
  onClick?: (username: string) => void;
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'muted' | 'highlight';
}

const ClickableUsername = ({ 
  username, 
  onClick, 
  className = "", 
  showIcon = false,
  variant = 'default'
}: ClickableUsernameProps) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'muted':
        return 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
      case 'highlight':
        return 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1 rounded';
      default:
        return 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick(username);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center space-x-1 transition-colors duration-200 ${getVariantClasses()} ${className}`}
      title={`View ${username}'s profile`}
    >
      {showIcon && <User className="w-3 h-3" />}
      <span className="font-medium">@{username}</span>
    </button>
  );
};

export default ClickableUsername;