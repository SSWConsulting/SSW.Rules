'use client';

import React from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';

interface PopupProps {
  isVisible: boolean;
  onClose: () => void;
  showCloseIcon?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const Popup: React.FC<PopupProps> = ({
  isVisible,
  onClose,
  showCloseIcon = true,
  children,
}) => {
  return (
    <Modal
      open={isVisible}
      onClose={onClose}
      center
      showCloseIcon={!!showCloseIcon}
      classNames={{
        closeButton: "!bg-white rounded-[15px]",
        overlay: "bg-black/50",
        modal: "w-[95vw] max-w-sm sm:max-w-md mx-auto my-4 !shadow-lg !bg-white rounded-lg !p-0 !m-0"
      }}
      animationDuration={500}
    >
      {children}
    </Modal>
  );
};

export default Popup;
