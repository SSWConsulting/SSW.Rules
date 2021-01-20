import React, { useState, useEffect, useRef } from 'react';
import DropdownCard from '../dropdown-card/dropdown-card';
import ProfileBadge from '../profile-badge/profile-badge';

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
      <ProfileBadge onClick={() => setOpen((open) => !open)} />
      {open && <DropdownCard setOpen={setOpen} />}
    </div>
  );
};

export default DropdownIcon;
