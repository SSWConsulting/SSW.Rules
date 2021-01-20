/* Likes/Dislikes */

const API_URL = process.env.API_BASE_URL + '/api';

export async function GetLikeDislikeForUser(ruleId, userId) {
  var query = userId
    ? `${API_URL}/GetLikesDislikesFunction?rule_guid=${ruleId}&user_id=${userId}`
    : `${API_URL}/GetLikesDislikesFunction?rule_guid=${ruleId}`;
  const response = await fetch(query);
  return await response.json();
}

export async function GetAllLikedDisliked(userId) {
  var query = `${API_URL}/GetAllLikedDisliked?&user_id=${userId}`;
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

  const response = await fetch(`${API_URL}/LikeDislikeFunction`, {
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
  Like: 0,
  DisLike: 1,
};

export async function RemoveLikeDislike(data, token) {
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }
  const response = await fetch(`${API_URL}/RemoveLikeDislikeFunction`, {
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
