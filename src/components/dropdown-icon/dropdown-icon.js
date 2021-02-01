import React, { useState, useEffect, useRef } from 'react';
import DropdownBadge from '../dropdown-badge/dropdown-badge';
import DropdownCard from '../dropdown-card/dropdown-card';

const DropdownIcon = () => {
  const [open, setOpen] = useState(false);

  const drop = useRef(null);
  function handleClick(e) {
    if (!e.target.closest(`.${drop.current.className}`) && open) {
      setOpen(false);
    }
  }
  useEffect(() => {
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  });
  return (
    <div className="dropdown" ref={drop}>
      <DropdownBadge onClick={() => setOpen((open) => !open)} />
      {open && <DropdownCard setOpen={setOpen} />}
    </div>
  );
};

export default DropdownIcon;
