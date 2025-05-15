export const sortItems = (items: any[], sortBy: string, sortOptions: { value: string; label: string; field: string }[]) => {
    const sortField = sortOptions.find(option => option.value === sortBy)?.field;
  
    if (!sortField) {
      return items;
    }
  
    return items.sort((a, b) => {
      const aDate = new Date(a[sortField]);
      const bDate = new Date(b[sortField]);
  
      return bDate.getTime() - aDate.getTime();
    });
};
  