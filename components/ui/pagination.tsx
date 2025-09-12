'use client';

import React from 'react';
import { Button } from './button';
import Dropdown from './dropdown';
import { RiArrowRightSLine, RiMoreFill } from 'react-icons/ri';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  className
}: PaginationProps) {
  const isShowingAll = itemsPerPage >= totalItems;
  const startItem = isShowingAll ? 1 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = isShowingAll ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);

  const itemsPerPageOptions = [
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '20', label: '20' },
    { value: '50', label: '50' },
    { value: totalItems.toString(), label: 'All' }
  ];

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 4) {
        pages.push('ellipsis-start');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 3) {
        pages.push('ellipsis-end');
      }
      
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();


  return (
    <div className={cn("mt-4", className)}>
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center justify-between">
        {/* Page navigation */}
        {!isShowingAll && (
          <div className="flex items-center gap-1">
            {visiblePages.map((page, index) => {
              if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                return (
                  <div
                    key={`ellipsis-${index}`}
                    className="flex items-center justify-center w-8 h-8 text-gray-500"
                  >
                    <RiMoreFill />
                  </div>
                );
              }
              
              const pageNum = page as number;
              const isActive = pageNum === currentPage;
              
              return (
                <Button
                  key={pageNum}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "w-8 h-8 p-0 text-sm cursor-pointer",
                    isActive && "bg-ssw-red text-white hover:bg-ssw-red/90"
                  )}
                >
                  {pageNum}
                </Button>
              );
            })}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 p-0 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiArrowRightSLine size={16} />
            </Button>
          </div>
        )}

        {/* Items per page and count */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Dropdown
              options={itemsPerPageOptions}
              value={itemsPerPage.toString()}
              onChange={(value) => onItemsPerPageChange(parseInt(value))}
              className="text-sm"
            />
            <span>per page</span>
          </div>
          <span>
            {startItem} - {endItem} of {totalItems} items
          </span>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden">
        {/* Page navigation - full width */}
        {!isShowingAll && (
          <div className="flex items-center justify-center gap-1 mb-4">
            {visiblePages.map((page, index) => {
              if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                return (
                  <div
                    key={`ellipsis-${index}`}
                    className="flex items-center justify-center w-8 h-8 text-gray-500"
                  >
                    <RiMoreFill />
                  </div>
                );
              }
              
              const pageNum = page as number;
              const isActive = pageNum === currentPage;
              
              return (
                <Button
                  key={pageNum}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "w-8 h-8 p-0 text-sm cursor-pointer",
                    isActive && "bg-ssw-red text-white hover:bg-ssw-red/90"
                  )}
                >
                  {pageNum}
                </Button>
              );
            })}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 p-0 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiArrowRightSLine size={16} />
            </Button>
          </div>
        )}

        {/* Items per page and count - centered on new line */}
        <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Dropdown
              options={itemsPerPageOptions}
              value={itemsPerPage.toString()}
              onChange={(value) => onItemsPerPageChange(parseInt(value))}
              className="text-sm"
            />
            <span>per page</span>
          </div>
          <span>
            {startItem} - {endItem} of {totalItems} items
          </span>
        </div>
      </div>
    </div>
  );
}