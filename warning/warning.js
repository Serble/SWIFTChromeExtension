let url;

function addAllowedDomain(domain, callback) {
    console.log("Allowing domain: " + domain);
    chrome.runtime.sendMessage({
        method: 'allow-domain',
        allowedDomain: domain
    }, callback);
}

function getSafetyScore(safeScore, unsafeScore) {
    const totalScore = safeScore + Math.abs(unsafeScore);
    if (totalScore > 0) {
        return Math.round((safeScore / totalScore) * 100);
    }
    return 0;
}

chrome.storage.local.get(['redirectUrl'], function(result) {
    url = result.redirectUrl;
    console.log("Loaded redirect URL: " + url);

    const domain = new URL(url).hostname;

    chrome.runtime.sendMessage({
        method: 'get-domain-votes',
        votedDomain: domain
    });

    const domainSpans = document.getElementsByClassName('domain');
    Array.from(domainSpans).forEach(element => {
        element.innerText = url;
    });

    console.log("Updated domain message spans")

    document.getElementById('proceedButton').onclick = function() {
        addAllowedDomain(domain, function() {
            console.log("Proceeding to " + url);
            window.location.href = url;
        });
        document.getElementById('proceedButton').innerHTML = "<a href='" + url + "'>Proceed</a>";
    };
});

// go back to safety button (takes user to new tab)
document.getElementById('backButton').onclick = function() {
    chrome.tabs.goBack();
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.method === 'obtained-domain-votes') {
            console.log("Received domain votes")
            // Check domain
            if (new URL(url).hostname === request.votes.domain) {
                // Update votes
                const score = getSafetyScore(request.votes.safeScore, request.votes.unsafeScore);

                const scoreSpans = document.getElementsByClassName('score');
                Array.from(scoreSpans).forEach(element => {
                    element.innerText = score;
                });
            }
        }
    }
);