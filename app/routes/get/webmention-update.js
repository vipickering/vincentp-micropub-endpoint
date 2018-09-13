const fetch = require('node-fetch');
const rp = require('request-promise');
const base64 = require('base64it');
const moment = require('moment');
const logger = require(appRootDirectory + '/app/functions/bunyan');
const config = require(appRootDirectory + '/app/config.js');
const webmention = config.webmention;
const github = config.github;

// We want to run the scheduler at 1am and GET all webmentions for the previous day.
const yesterday  =  moment().subtract(1, 'days').format('YYYY-MM-DDTHH:mm:ss+01:00');
const webmentionIO = 'https://webmention.io/api/mentions?domain=vincentp.me&since=since=' + yesterday + '&token=' + webmention.token;

exports.webmentionUpdateGet = function webmentionUpdateGet(req, res) {
    const messageContent = ':robot: Webmentions updated by Mastrl Cntrl';
    const postFileName = 'webmentions.json';
    const postDestination = github.postUrl + '/contents/_data/' + postFileName;
    const apiOptions = {
        uri : postDestination,
        headers : {
            Authorization : 'token ' + github.key,
            'Content-Type' : 'application/vnd.github.v3+json; charset=UTF-8',
            'User-Agent' : github.name
        },
        json : true
    };
    let payload;
    let options;
    let currentWebmentions;
    let encodedContent;

    function isEmptyObject(obj) {
        return !Object.keys(obj).length;
    }

    function isEmptyObject(obj) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          return false;
        }
      }
      return true;
    }

    function handleGithubApiGet(err) {
        logger.info('Github API Get File Failed');
        logger.error(err);
        res.status(400);
        res.send('Internal Error Please Contact Author');
    }

    function handlePatchError(err) {
        logger.info('Webmention update to Github API Failed');
        logger.error(err);
        res.status(400);
        res.send('Update failed');
    }

    function functionFinish() {
        res.status(202);
        res.send('Accepted');
    }

    logger.info(webmentionIO);

    fetch(webmentionIO)
        .then(res => res.json())
        .then(function(json) {
            if (isEmptyObject(json.links)) {
                // There are no webmentions so quit.
                res.status(200);
                res.send('Done');
            } else {
                // There is at least one webmention
                const webmentionsToAdd = json.links[0];
                rp(apiOptions)
                    .then((repos) => {
                        currentWebmentions = base64.decode(repos.content);

                        let obj = JSON.parse(currentWebmentions);
                        // logger.info(currentWebmentions);
                        obj['links'].push(webmentionsToAdd);
                        // logger.info(obj);
                        payload = JSON.stringify(obj);

                        logger.info('payload combined');

                        encodedContent = base64.encode(payload);

                        logger.info('payload encoded');

                        options = {
                            method : 'PUT',
                            uri : postDestination,
                            headers : {
                                Authorization : 'token ' + github.key,
                                'Content-Type' : 'application/vnd.github.v3+json; charset=UTF-8',
                                'User-Agent' : github.name
                            },
                            body : {
                                path : postFileName,
                                branch : 'master',
                                message : messageContent,
                                sha : repos.sha,
                                committer : {
                                    'name' : github.user,
                                    'email' : github.email
                                },
                                content : encodedContent
                            },
                            json : true
                        };

                        rp(options)
                            .then(functionFinish)
                            .catch(handlePatchError);
                    })
                    .catch(handleGithubApiGet);
            }
            return;
        });
};
