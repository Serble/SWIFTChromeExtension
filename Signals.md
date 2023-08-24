# Signals
Here I am documenting all signals that are used in the project.

## Page Bound

### `login-sucess`
Emitted when the user has successfully logged in. There are no arguments.

### `refresh-votes`
Emitted when the user has voted on a post. Args:  
- `domain`: The domain whose information changed.

### `obtained-user-vote`
Emitted when the user's vote on a domain is obtained. Args:
- `domain`: The domain whose vote was obtained.
- `vote`: The vote the user has on the domain.

### `obtained-domain-votes`
Emitted when the votes on a domain are obtained. Args:
- `votes.domain`: The domain whose votes were obtained.
- `votes.totalVotes`: The total number of votes on the domain.
- `votes.safeScore`: The safe score of the domain.
- `votes.unsafeScore`: The unsafe score of the domain.

### `dialog`
Emitted to open an alert box. Args:
- `msg`: The message to display in the alert box.

## Background Bound

### `allow-domain`
Adds a domain to a list to stop a warning from being displayed when the user visits the domain. Args:
- `allowedDomain`: The domain to add to the list.

### `clear-allowed`
Clears the list of allowed domains. There are no arguments.

### `login`
Triggers a login. Starts the login process. There are no arguments.

### `get-login-status`
Gets the login status. Args:
- `callback`: A callback function that is called with the login status.
Return object:
- `loggedIn`: Whether the user is logged in or not.
- `userObject`: The user object if the user is logged in, otherwise `null`.

### `vote-domain`
Votes on a domain. Args:
- `votedDomain`: The domain to vote on.
- `vote`: true for upvote, false for downvote.

### `get-users-vote`
Gets the user's vote on a domain. Args:
- `votedDomain`: The domain to get the vote for.

### `get-domain-votes`
Gets the votes on a domain. Args:
- `votedDomain`: The domain to get the votes for.