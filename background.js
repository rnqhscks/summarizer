// 확장 프로그램이 설치되거나 업데이트될 때 실행
chrome.runtime.onInstalled.addListener(() => {
	console.log('확장 프로그램이 설치되었습니다.');
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'log') {
		const { type, content } = request.data;
		switch (type) {
			case 'API_INPUT':
				console.log('API 입력 (Prompt):', content);
				break;
			case 'API_RESPONSE':
				console.log('API 응답:', content);
				break;
			case 'ERROR':
				console.error('에러 발생:', content);
				break;
			default:
				console.log('기타 로그:', content);
		}
	}
	if (request.action === 'getPageContent') {
		// 현재 활성화된 탭의 정보 가져오기
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (chrome.runtime.lastError) {
				console.error(chrome.runtime.lastError);
				sendResponse({ error: '탭 정보를 가져올 수 없습니다.' });
				return;
			}

			const tab = tabs[0];
			if (!tab) {
				sendResponse({ error: '활성화된 탭을 찾을 수 없습니다.' });
				return;
			}

			// 페이지 내용 가져오기
			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: () => {
					return document.body.innerText;
				}
			}, (results) => {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError);
					sendResponse({ error: '페이지 내용을 가져올 수 없습니다.' });
					return;
				}

				if (results && results[0]) {
					sendResponse({ content: results[0].result });
				} else {
					sendResponse({ error: '페이지 내용을 가져올 수 없습니다.' });
				}
			});
		});

		return true; // 비동기 응답을 위해 true 반환
	}
});

chrome.action.onClicked.addListener(async tab => {
	try {
		// ✅ 먼저 content.js가 실행될 수 있는 페이지인지 확인
		if (
			!tab.id ||
			tab.url.startsWith('chrome://') ||
			tab.url.startsWith('chrome-extension://')
		) {
			console.error(
				'이 페이지에서는 content script를 실행할 수 없습니다.',
			);
			return;
		}

		// ✅ content.js 실행
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['content.js'],
		});

		// ✅ 실행 후 메시지 보내기
		chrome.tabs.sendMessage(tab.id, { action: 'togglePopup' }, response => {
			if (chrome.runtime.lastError) {
				console.error(
					'메시지 전송 오류:',
					chrome.runtime.lastError.message,
				);
			} else {
				console.log('popupAppearence 상태:', response);
			}
		});
	} catch (err) {
		console.error('content script 실행 오류:', err);
	}
});
