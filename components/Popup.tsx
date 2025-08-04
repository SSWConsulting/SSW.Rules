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
        modal: "sm:max-w-3xl sm:m-5 sm:p-5 w-full mx-0 !shadow-none !bg-black/0"
      }}
      animationDuration={500}
    >
      {children}
    </Modal>
  );
};

export default Popup;
