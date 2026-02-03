"use client";

import React, { useState } from "react";
import Popup from "./Popup";
import Spinner from "./Spinner";

interface BranchCreationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onBranchCreated: (branchName: string) => void;
  createBranch: (data: { baseBranch: string; branchName: string }) => Promise<string>;
  currentBranch: string;
}

const BranchCreationModal: React.FC<BranchCreationModalProps> = ({
  isVisible,
  onClose,
  onBranchCreated,
  createBranch,
  currentBranch,
}) => {
  const [branchName, setBranchName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatBranchName = (str: string): string => {
    // Remove invalid characters and convert to lowercase
    // Git branch names cannot have: spaces, ~, ^, :, ?, *, [, \, consecutive dots, end with .lock
    return str
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[~^:?*\[\]\\]+/g, "")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+|\.+$/g, "");
  };

  const handleCreateBranch = async () => {
    const trimmedName = branchName.trim();
    if (!trimmedName) {
      setError("Branch name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const formattedName = formatBranchName(trimmedName);
      if (!formattedName) {
        setError("Invalid branch name after formatting");
        setIsCreating(false);
        return;
      }

      const createdBranchName = await createBranch({
        baseBranch: currentBranch,
        branchName: formattedName,
      });

      onBranchCreated(createdBranchName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create branch");
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating && branchName.trim()) {
      handleCreateBranch();
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setBranchName("");
      setError(null);
      onClose();
    }
  };

  return (
    <Popup showCloseIcon={!isCreating} isVisible={isVisible} onClose={handleClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-2">Create a New Branch</h3>
        <p className="text-gray-600 text-sm mb-4">
          You are on a protected branch (<span className="font-medium">{currentBranch}</span>). To add
          categories, you need to create a new branch first.
        </p>

        <div className="mb-4">
          <label htmlFor="branchName" className="block text-sm font-medium text-gray-700 mb-1">
            Branch Name
          </label>
          <input
            id="branchName"
            type="text"
            value={branchName}
            onChange={(e) => {
              setBranchName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g., feature/add-categories"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isCreating}
            autoFocus
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isCreating}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateBranch}
            disabled={isCreating || !branchName.trim()}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Spinner size="sm" inline className="text-white" />
                <span>Creating...</span>
              </>
            ) : (
              "Create Branch & Switch"
            )}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default BranchCreationModal;
