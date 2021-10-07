const { google } = require('googleapis');

const DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';

const BaseMinValues = {
	TOXICITY: 0.5,
	SEVERE_TOXICITY: 0.5,
	// IDENTITY_ATTACK: 0.5,
	// INSULT: 0.5,
	// PROFANITY: 0.5,
	// THREAT: 0.5,
	// SEXUALLY_EXPLICIT: 0.5,
};

module.exports.getResults = (content) => {
	return new Promise((resolve, reject) => {
		// eslint-disable-next-line no-control-regex
		const msg = content.replace(/[^\x00-\x7F]/g, '').trim();

		if (msg.length <= 1) return reject();

		google.discoverAPI(DISCOVERY_URL).then((client) => {
			const analyzeRequest = {
				comment: {
					text: msg,
				},
				requestedAttributes: {
					TOXICITY: {},
					SEVERE_TOXICITY: {},
					// IDENTITY_ATTACK: {},
					// INSULT: {},
					// PROFANITY: {},
					// THREAT: {},
					// SEXUALLY_EXPLICIT: {},
				},
			};

			client.comments.analyze(
				{
					key: process.env.GOOGLE_API_KEY,
					resource: analyzeRequest,
				},
				(err, response) => {
					if (err) return reject(err);
					resolve(response.data);
				});
		}).catch((err) => {
			reject(err);
		});
	});
};

module.exports.shouldCensor = (results, multiplier) => {
	if (!multiplier) multiplier = 1;
	const scores = results.attributeScores;

	for (const key in BaseMinValues) {
		if (scores[key]) {
			const censorValue = BaseMinValues[key] * multiplier;
			const score = scores[key].summaryScore.value;

			if (score >= censorValue) {
				return {
					shouldCensor: true,
					initiatingField: key,
					initiatingScore: score,
					censorValue: censorValue,
				};
			}
		}
	}

	return {
		shouldCensor: false,
	};
};