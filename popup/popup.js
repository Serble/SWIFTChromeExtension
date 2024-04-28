// State
let loginButtonClickable = true;

// Funcs
function getActiveDomain(callback) {
  chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
    const url = new URL(tabs[0].url);
    let hostname = url.hostname;
    if (hostname.startsWith("www.")) {
        hostname = hostname.substring(4);
    }
    callback(hostname);
  });
}

function changeLoginButton(text, clickable) {
    document.getElementById("login-text").innerText = text;
    loginButtonClickable = clickable;
}

function getSafetyScore(safeScore, unsafeScore) {
    const totalScore = safeScore + Math.abs(unsafeScore);
    if (totalScore > 0) {
        return Math.round((safeScore / totalScore) * 100);
    }
    return 0;
}

function setTrustedButtonToggled(toggled) {
    let button = document.getElementById('trust-button');
    if (toggled) {
        // Set style
        button.style.backgroundColor = "#628162FF";
        button.disabled = true;
        return;
    }
    button.style.backgroundColor = "";
}
function setFlagButtonToggled(toggled) {
    let button = document.getElementById('flag-button');
    if (toggled) {
        // Set style
        button.style.backgroundColor = "#628162FF";
        button.disabled = true;
        return;
    }
    button.style.backgroundColor = "";
}

let loggedIn = false;

// Buttons
document.getElementById('trust-button').addEventListener('click', function() {
    if (!loggedIn) {
        alert("You must be logged in to vote!");
        return;
    }
    setTrustedButtonToggled(true);
    setFlagButtonToggled(false);
    getActiveDomain(function(domain) {
        chrome.runtime.sendMessage({
            method: 'vote-domain',
            votedDomain: domain,
            vote: true
        });
    });
});

document.getElementById('flag-button').addEventListener('click', function() {
    if (!loggedIn) {
        alert("You must be logged in to vote!");
        return;
    }
    setFlagButtonToggled(true);
    setTrustedButtonToggled(false);
    getActiveDomain(function(domain) {
      chrome.runtime.sendMessage({
          method: 'vote-domain',
          votedDomain: domain,
          vote: false
      });
    });
});

document.getElementById('clear-trusted').addEventListener('click', function() {
    chrome.runtime.sendMessage({
      method: 'clear-allowed'
    });
    alert("All trusted domains have been cleared!");
});

document.getElementById('login-button').addEventListener('click', function() {
    if (!loginButtonClickable) {
        return;
    }
    changeLoginButton("Logging in...", false)
    chrome.runtime.sendMessage({
        method: 'login'
    });
});

document.getElementById('get-premium').addEventListener('click', function() {
    chrome.tabs.create({url: "https://serble.net/swift"});
});

// Listen for login
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.method === 'login-success') {
            changeLoginButton("Logged in!", false);
            if (!loggedIn) {
                obtainLoginStatus();
            }
        }

        if (request.method === 'obtained-user-vote') {
            // Check domain
            getActiveDomain(function(domain) {
                if (domain === request.domain) {
                    // Check vote
                    if (request.vote >= 1) {
                        setTrustedButtonToggled(true);
                        setFlagButtonToggled(false);
                    } else if (request.vote <= -1) {
                        setTrustedButtonToggled(false);
                        setFlagButtonToggled(true);
                    } else {
                        setTrustedButtonToggled(false);
                        setFlagButtonToggled(false);
                    }
                }
            });
        }

        if (request.method === 'obtained-domain-votes') {
            // Check domain
            getActiveDomain(function(domain) {
                if (domain === request.votes.domain) {
                    // Update votes
                    document.getElementById('trust-value').innerText = "" + getSafetyScore(request.votes.safeScore, request.votes.unsafeScore) + "%";
                    document.getElementById('votes-value').innerText = "" + request.votes.totalVotes;
                    document.getElementById('system-value').innerText = "" + request.votes.botRating + "%";
                }
            });
        }

        if (request.method === 'refresh-votes') {
            getActiveDomain(function(domain) {
                if (domain === request.domain) {
                    chrome.runtime.sendMessage({
                        method: 'get-domain-votes',
                        votedDomain: domain
                    });
                    chrome.runtime.sendMessage({
                        method: 'get-users-vote',
                        votedDomain: domain
                    });
                }
            });
        }

        if (request.method === 'dialog') {
            alert(request.msg);
        }
    }
);

// Check login
function obtainLoginStatus() {
    chrome.runtime.sendMessage({
        method: 'get-login-status'
    }, function (response) {
        if (response.loggedIn) {
            loggedIn = true;
            let premiumString = "";
            if (response.userObject.premium) {
                premiumString = " (Premium)";  // Append "(Premium)" to the end of the username
                document.getElementById("get-premium").style.display = "none";  // Remove get premium button
                document.getElementById("bot-rating-box").style.display = "";  // Show bot rating box
                document.getElementById("body").classList.add("premium-body");  // Set the background to premium
            }
            changeLoginButton("Logged in as " + response.userObject.username + premiumString, false);

            getActiveDomain(function(domain) {
                chrome.runtime.sendMessage({
                    method: 'get-users-vote',
                    votedDomain: domain
                });
            });
        }
    });
}

getActiveDomain(function(domain) {
    chrome.runtime.sendMessage({
        method: 'get-domain-votes',
        votedDomain: domain
    });
});

obtainLoginStatus();

console.log("popup.js loaded")