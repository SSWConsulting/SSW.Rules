/* Reactions */

const API_URL = process.env.API_BASE_URL + '/api';
const GITHUB_API_PAT = process.env.GITHUB_API_PAT;

export async function GetReactionForUser(ruleId, userId) {
  var query = userId
    ? `${API_URL}/GetReactionsFunction?rule_guid=${ruleId}&user_id=${userId}`
    : `${API_URL}/GetReactionsFunction?rule_guid=${ruleId}`;
  const response = await fetch(query);
  return await response.json();
}

export async function GetAllLikedDisliked(userId) {
  var query = `${API_URL}/GetAllReactionsFunction?&user_id=${userId}`;
  const response = await fetch(query);
  return await response.json();
}

export async function PostReactionForUser(data, token) {
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }

  const response = await fetch(`${API_URL}/ReactFunction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export const ReactionType = {
  SuperLike: 3,
  Like: 2,
  DisLike: 1,
  SuperDisLike: 0,
};

export async function RemoveReaction(data, token) {
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }
  const response = await fetch(`${API_URL}/RemoveReactionFunction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

/* Bookmarks */

export async function GetBookmarksForUser(userId, ruleId) {
  var query = ruleId
    ? `${API_URL}/GetBookmarkStatusFunction?rule_guid=${ruleId}&user_id=${userId}`
    : `${API_URL}/GetAllBookmarked?user_id=${userId}`;
  const response = await fetch(query);
  return await response.json();
}

export async function BookmarkRule(data, token) {
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }
  const response = await fetch(`${API_URL}/BookmarkRuleFunction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function RemoveBookmark(data, token) {
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }
  const response = await fetch(`${API_URL}/RemoveBookmarkFunction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

/* Secret Content */

export async function GetGithubOrganisations(username) {
  const response = await fetch(
    `https://api.github.com/users/${username}/orgs`,
    {
      method: 'GET',
      headers: {
        Authorization: `token ${GITHUB_API_PAT}`,
      },
    }
  );
  return response.json();
}

export async function GetGithubOrganisationName(orgID) {
  const response = await fetch(
    `https://api.github.com/organizations/${orgID}`,
    {
      method: 'GET',
      headers: {
        Authorization: `token ${GITHUB_API_PAT}`,
      },
    }
  );
  return response.json();
}

export async function setUserOrganisation(data, token) {
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }
  const response = await fetch(`${API_URL}/AddUserOrganisationFunction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function GetOrganisations(userId) {
  const response = await fetch(
    `${API_URL}/GetOrganisationsFunction?user_id=${userId}`
  );
  return response.json();
}

export async function GetSecretContent(Id, token) {
  const response = await fetch(`${API_URL}/GetSecretContentFunction?id=${Id}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
}

/* Profile Page */

export async function GetUserComments(username, commentsRepository) {
  var query = `https://api.github.com/search/issues?q=is:issue+is:open+repo:${commentsRepository}+commenter:${username}`;
  const response = await fetch(query, {
    headers: {
      Authorization: `token ${GITHUB_API_PAT}`,
    },
  });

  return await response.json();
}
