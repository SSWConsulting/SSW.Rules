"use client";

import React from "react";
import { countMatchingAuthors, DEFAULT_AUTHOR, RuleAuthor } from "../collection/shared/authors";
import { ConditionalHiddenField } from "./ConditionalHiddenField";

/**
 * Custom TinaCMS list component for the `authors` field.
 *
 * Pre-fills new authors with Adam Cogan only when he isn't already on the rule,
 * so clicking "+" never creates a duplicate (which would also block Tina from opening the new item).
 */
export const AuthorsListField: React.FC<any> = (props) => {
  const authors: RuleAuthor[] = Array.isArray(props.input.value) ? props.input.value : [];
  const hasDefaultAuthor = countMatchingAuthors(authors, "url", DEFAULT_AUTHOR.url) > 0 || countMatchingAuthors(authors, "title", DEFAULT_AUTHOR.title) > 0;

  return <ConditionalHiddenField {...props} field={{ ...props.field, defaultItem: hasDefaultAuthor ? {} : DEFAULT_AUTHOR }} />;
};
