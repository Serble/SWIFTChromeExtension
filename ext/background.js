const redirect_url = chrome.identity.getRedirectURL();
const client_id = '9277c54d-edb8-4b82-ad77-3211eb294683';
const scope = 'user_info';

// API URLs including a fallback in case the main one is blocked
let backend_url = 'https://swiftbackend.serble.net';
const fallback_backend_url = 'https://swiftbackend.zaneharrison.com';

// OAuth URL including a fallback in case the main one is blocked
let auth_url = 'https://serble.net/oauth/authorize?' +
    'client_id=' + client_id +
    '&response_type=token' +
    '&redirect_uri=' + encodeURIComponent(redirect_url) +
    '&scope=' + scope +
    '&state=';
const fallback_auth_url = 'https://serble.zaneharrison.com/oauth/authorize?' +
    'client_id=' + client_id +
    '&response_type=token' +
    '&redirect_uri=' + encodeURIComponent(redirect_url) +
    '&scope=' + scope +
    '&state=';

// Login state variables
let loggedIn = false;
let token = null;
let userObject = null;

let allowedDomains = [];
let onLoginCallbacks = [];

// At some schools serble.net may be blocked, so we need to check if we can access it and fallback to a different URL if we can't
function checkDomainBlockStatus() {
    fetch(backend_url, {
        method: 'GET'
    })
        .then(data => {
            console.log("Serble.net is not blocked");
        })
        .catch(error => {
            console.error("Serble.net is blocked, falling back to " + fallback_backend_url);
            backend_url = fallback_backend_url;
        });
}
checkDomainBlockStatus();

function login() {
    const state = generateState();

    chrome.identity.launchWebAuthFlow({url: auth_url + state, interactive: true}, function(redirect_url) {
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
            return;
        }

        const authorized = /authorized=true/.test(redirect_url);
        const state_match = redirect_url.match(/state=([\w]+)/);
        const token_match = redirect_url.match(/code=([\w-.]+)/);

        const returned_state = state_match ? state_match[1] : null;
        const token = token_match ? token_match[1] : null;

        if (authorized && state === returned_state && token) {
            // The user is authorized, the states match, and we've got a token. We're good to proceed.
            console.log("User is authorized");
            console.log("Obtained token: ", token);
            swiftAuth(token);
        }
        else {
            //Authorization was not successful
            console.log("Authorization was not successful");
        }
    });
}

function swiftAuth(code) {
    fetch(backend_url + '/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({token: code})
    })
        .then(response => response.json())
        .then(data => {
            token = data.access_token;
            loggedIn = true;
            console.log("Logged in successfully");
            obtainUserObj();

            chrome.storage.local.set({refreshToken: data.refresh_token});
        })
        .catch(error => console.error('Error:', error));
}

function obtainUserObj() {
    fetch(backend_url + '/account', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => response.json())
        .then(data => {
            userObject = data;
            console.log("Obtained user object");

            onLoginCallbacks.forEach(callback => {
                callback();
            });
            console.log("Executed onLoginCallbacks");

            chrome.runtime.sendMessage({
                method: 'login-success'
            }).catch(_ => {
                console.log("Tried to send login-success message but failed");
            });
        })
        .catch(error => console.error('Error:', error));
}

function voteDomain(domain, vote) {
    fetch(backend_url + '/vote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            domain: domain,
            vote: vote
        })
    })
    .catch(error => {
        if (error instanceof Response && error.status === 401) {  // Our token expired
            console.log("Token expired, refreshing...");
            userObject = null;
            token = null;
            loggedIn = false;
            getTokenAndRefresh();

            onLoginCallbacks.push(() => {
                voteDomain(domain, vote);
            });
            return;
        }

        console.log("Failed to vote: ", error);
        chrome.runtime.sendMessage({
            method: 'dialog',
            msg: 'You cannot vote on this domain.'
        });
    })
    .then(data => {
        chrome.runtime.sendMessage({
            method: 'refresh-votes',
            domain: domain
        });
    });
}

function getUsersVote(domain) {
    fetch(backend_url + '/vote/user/' + domain, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            chrome.runtime.sendMessage({
                method: 'obtained-user-vote',
                domain: domain,
                vote: data.vote
            });
        })
        .catch(error => {
            if (error instanceof Response && error.status === 401) {  // Our token expired
                console.log("Token expired, refreshing...");
                userObject = null;
                token = null;
                loggedIn = false;
                getTokenAndRefresh();

                onLoginCallbacks.push(() => {
                    getUsersVote(domain);
                });
                return;
            }

            console.error('Error:', error)
        });
}

function getDomainVotes(domain) {
    fetch(backend_url + '/vote/' + domain, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            chrome.runtime.sendMessage({
                method: 'obtained-domain-votes',
                votes: data
            });
        })
        .catch(error => console.error('Error:', error));
}

async function getDomainVotesBlocking(domain) {
    try {
        const response = await fetch(backend_url + '/vote/' + domain, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
    }
}

function performTokenRefresh(refreshToken) {
    fetch(backend_url + '/authenticate/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({RefreshToken: refreshToken})
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            token = data.access_token;
            loggedIn = true;
            console.log("Logged in successfully");
            obtainUserObj();

            chrome.storage.local.set({refreshToken: data.refresh_token});
        })
        .catch(error => console.error('Error:', error));
}

function generateState() {
    let state = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 16; i++) {
        state += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return state;
}

function getSafetyScore(safeScore, unsafeScore) {
    const totalScore = safeScore + Math.abs(unsafeScore);
    if (totalScore > 0) {
        return Math.round((safeScore / totalScore) * 100);
    }
    return 0;
}

function updateIcon(trustPercent) {
    let iconName;

    if (trustPercent === -1) {
        iconName = 'unknown';
    }
    else if (trustPercent === 100) {
        iconName = '6';
    }
    else if (trustPercent >= 80) {
        iconName = '5';
    }
    else if (trustPercent >= 60) {
        iconName = '4';
    }
    else if (trustPercent >= 40) {
        iconName = '3';
    }
    else if (trustPercent >= 20) {
        iconName = '2';
    }
    else {
        iconName = '1';
    }

    chrome.action.setIcon({path: '../icons/trust-stages/' + iconName + '.png'});
    console.log("Updated icon to " + iconName);
}




// Get saved login
function getTokenAndRefresh() {
    chrome.storage.local.get(['refreshToken'], function(result) {
        console.log("Checking for existing login...");
        console.log(result);
        if (result == null) {
            console.log("No existing login found (Null result)");
            return;
        }
        if (result.refreshToken == null) {
            console.log("No existing login found (Null token)");
            return;
        }
        console.log("Existing login found, refresh token: " + result.refreshToken);
        performTokenRefresh(result.refreshToken);
    });
}
getTokenAndRefresh();


// ALLOWED DOMAINS
chrome.storage.local.get(['allowedDomains'], function(result) {
    if (result == null || result.allowedDomains == null) {
        console.log("No allowed domains found");
        return;
    }
    allowedDomains = result.allowedDomains;
    console.log("Allowed domains found: ", allowedDomains);
});

function allowDomain(url) {
    if (url == null) {
        console.error("Failed to allow domain: url was null");
        return;
    }
    allowedDomains.push(url);
    console.log("Allow was pushed: " + url)
    chrome.storage.local.set({allowedDomains: allowedDomains});
}

function clearAllowed() {
    allowedDomains = [];
    chrome.storage.local.set({allowedDomains: []});
}

// Icon updater
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, function(tab){
        if (!tab.url) {
            return;
        }
        let url = new URL(tab.url);
        let hostname = url.hostname;
        if (hostname.startsWith("www.")) {
            hostname = hostname.substring(4);
        }
        console.log("Tab activated: " + hostname);
        getDomainVotesBlocking(hostname).then(rating => {
            if (rating.totalVotes === 0) {
                updateIcon(-1);
                return;
            }
            let score = getSafetyScore(rating.safeScore, rating.unsafeScore);
            updateIcon(score);
        });
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        let url = new URL(changeInfo.url);
        let hostname = url.hostname;

        if (hostname.startsWith("www.")) {
            hostname = hostname.substring(4);
        }

        if (allowedDomains.includes(hostname)) {
            updateIcon(100);  // It's allowed, so it's safe
            return;
        }

        getDomainVotesBlocking(hostname).then(domainTrustRating => {
            if (domainTrustRating.totalVotes === 0) {  // There are no votes, so we can't determine if it's safe or not
                console.log("No votes for domain " + hostname + ", setting icon to unknown");
                updateIcon(-1);
                return;
            }

            let score = getSafetyScore(domainTrustRating.safeScore, domainTrustRating.unsafeScore); // Calculate your score
            updateIcon(score); // Update icon

            if (score <= 40 && domainTrustRating.totalVotes > 0) {
                console.log("The domain " + hostname + " is unsafe, redirecting...");
                chrome.tabs.update(tabId, {url: 'warning/warning.html'}); // Redirect to warning page
                chrome.storage.local.set({redirectUrl: changeInfo.url}); // Store original URL for later reference
            }
        });
    }
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.method === 'allow-domain') {
            allowDomain(request.allowedDomain);
            console.log("Domain allowed: " + request.allowedDomain)
            sendResponse();
        }
        if (request.method === 'clear-allowed') {
            clearAllowed();
            console.log("All domains cleared")
        }
        if (request.method === 'login') {
            login();
        }
        if (request.method === 'get-login-status') {
            sendResponse({loggedIn: loggedIn, userObject: userObject});
        }
        if (request.method === 'vote-domain') {
            voteDomain(request.votedDomain, request.vote);
        }
        if (request.method === 'get-users-vote') {
            getUsersVote(request.votedDomain);
        }
        if (request.method === 'get-domain-votes') {
            getDomainVotes(request.votedDomain);
        }
    }
);


function isDomainAllowed(domain, callback) {
    chrome.storage.local.get(['allowedDomains'], function(result) {
        if (!result.allowedDomains || !result.allowedDomains.includes(domain)) {
            callback();
        } else {
            console.log("Domain is allowed");
        }
    });
}