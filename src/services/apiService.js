const API_URL = process.env.API_BASE_URL + '/api'; // process.env.base_url

export async function GetLikeDislikeForUser(ruleId, userId) {
  // validate input

  // build query string
  var query = userId
    ? `${API_URL}/GetLikesDislikesFunction?rule_guid=${ruleId}&user_id=${userId}`
    : `${API_URL}/GetLikesDislikesFunction?rule_guid=${ruleId}`;

  // 2do fetch
  const response = await fetch(query);
  return await response.json();
}

export async function PostReactionForUser(data, token) {
  // validate input
  // data.userId
  // data.ruleGuid
  // data.ReactionType
  // any other members
  if (data == null) {
    return {
      error: true,
      message: 'Data is empty or in the wrong format',
    };
  }

  // do fetch (with method type post)
  const response = await fetch(`${API_URL}/LikeDislikeFunction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, // <- need a better way to insert auth token than passing it through as a param
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data), // make sure this is using validated data
  });
  return response.json();
}

export const ReactionType = {
  Like: 0,
  DisLike: 1,
};
