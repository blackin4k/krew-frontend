import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions, className }) => {
  return (
    <div className={cn('flex items-center justify-between mb-6 px-6 md:px-8', className)}>
      <div className="flex items-center gap-4 min-w-0">
        {icon && (
          <div className="p-4 rounded-xl bg-secondary shadow-lg flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl font-display font-bold truncate">{title}</h2>
          {subtitle && <p className="text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
};

export default PageHeader;
