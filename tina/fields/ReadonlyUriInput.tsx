"use client";

import React from "react";

export const ReadonlyUriInput: React.FC<any> = ({ input, tinaForm }) => {
  const isReadonly = tinaForm?.crudType === "update";

  return (
    <input
      type="text"
      id={input.name}
      {...input}
      readOnly={isReadonly}
      disabled={isReadonly}
      className={`w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
        isReadonly ? "bg-gray-100 cursor-not-allowed opacity-75" : "bg-white"
      }`}
    />
  );
};
