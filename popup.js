/*




async function putContentInSummary() {
	const summary = document.getElementById('summary');
	try {
		if (!summary) {
			console.error('summary 요소를 찾을 수 없습니다.');
			return;
		}

		const summaryContent = document.createElement('div');

		const webContent = await getPageHtml();

		const prompt1 = `다음은 웹페이지의 텍스트만을 추출한 것이다. 다음을 사용자가 꼭 필요한 내용만을 중심으로 요약하여 정리하여 제공하여라. ${webContent}`;
		summaryContent.innerHTML = await generateContent(prompt1);

		summary.appendChild(summaryContent);
	} catch (error) {
		console.error('HTML 가져오기 실패:', error);
		summary.innerHTML = '<p>요약 정보를 가져올 수 없습니다.</p>'; // 사용자에게 오류 메시지 표시
	}
}
*/

async function generateContent(prompt) {
	try {
		// API 입력 로그 전송
		chrome.runtime.sendMessage({
			action: 'log',
			data: {
				type: 'API_INPUT',
				content: prompt
			}
		});

		const response = await fetch('http://172.16.9.119:3000/generate-content', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ prompt }),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		// API 응답 로그 전송
		chrome.runtime.sendMessage({
			action: 'log',
			data: {
				type: 'API_RESPONSE',
				content: data
			}
		});
		console.log('API 응답 데이터:', data);
		console.log('요약된 텍스트:', data.text);
		return data.text;
	} catch (error) {
		console.error('API 호출 중 오류 발생:', error);
		// 에러 로그 전송
		chrome.runtime.sendMessage({
			action: 'log',
			data: {
				type: 'ERROR',
				content: error.message
			}
		});
		throw new Error('API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
	}
}

async function getPageHtml() {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab) {
			throw new Error('활성화된 탭을 찾을 수 없습니다.');
		}

		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			function: () => {
				const parser = new DOMParser();
				const doc = parser.parseFromString(document.documentElement.outerHTML, 'text/html');

				// script, style, footer, header 태그 제거
				const scripts = doc.getElementsByTagName('script');
				const styles = doc.getElementsByTagName('style');
				const footers = doc.getElementsByTagName('footer');
				const headers = doc.getElementsByTagName('header');
				
				// HTMLCollection을 배열로 변환하여 제거 (실시간 컬렉션이므로 역순으로 제거)
				Array.from(scripts).reverse().forEach(script => script.remove());
				Array.from(styles).reverse().forEach(style => style.remove());
				Array.from(footers).reverse().forEach(footer => footer.remove());
				Array.from(headers).reverse().forEach(header => header.remove());

				// 불필요한 요소 제거
				const unwantedSelectors = [
					'.ad',
					'#advertisement',
					'.popup',
					'.banner',
				];
				unwantedSelectors.forEach(selector => {
					const unwantedElements = doc.querySelectorAll(selector);
					unwantedElements.forEach(element => element.remove());
				});

				// 모든 텍스트 추출
				const textContent = doc.body.textContent || doc.body.innerText || '';
				return textContent.replace(/\s+/g, ' ').trim();
			}
		});

		if (!results || !results[0] || !results[0].result) {
			throw new Error('페이지 내용을 가져올 수 없습니다.');
		}

		return results[0].result;
	} catch (error) {
		console.error('페이지 내용 가져오기 실패:', error);
		throw new Error('페이지 내용을 가져오는 중 오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해주세요.');
	}
}

// marked 라이브러리가 로드되었는지 확인하는 함수
function waitForMarked() {
	return new Promise((resolve) => {
		if (window.marked) {
			resolve();
		} else {
			const checkMarked = setInterval(() => {
				if (window.marked) {
					clearInterval(checkMarked);
					resolve();
				}
			}, 100);
		}
	});
}

document.addEventListener('DOMContentLoaded', async () => {
	console.log('DOM 로드 완료');
	const summarizeBtn = document.getElementById('summarizeBtn');
	const summaryContainer = document.getElementById('summary');
	const loadingElement = document.getElementById('loading');

	if (!summarizeBtn || !summaryContainer || !loadingElement) {
		console.error('필요한 DOM 요소를 찾을 수 없습니다.');
		return;
	}

	// marked 라이브러리가 로드될 때까지 대기
	await waitForMarked();

	summarizeBtn.addEventListener('click', async () => {
		try {
			console.log('요약 버튼 클릭됨');
			loadingElement.style.display = 'block';
			summaryContainer.textContent = '';

			const webContent = await getPageHtml();
			console.log('웹페이지 내용 추출 완료');

			const prompt = `
다음은 웹페이지의 텍스트만을 추출한 것입니다.
이 내용을 사용자가 꼭 필요한 정보만 빠르게 파악할 수 있도록 마크다운 형식으로 요약 정리해주세요.

**무조건 아래의 형식을 따르세요:**
- 각 섹션은 ## 로 시작합니다.
- 중요 키워드는 **굵게** 표시합니다.
- 목록은 - 로 시작합니다.

**그리고 반드시 다음 조건을 지켜주세요:**
1. 줄바꿈(엔터)이 너무 많습니다. 꼭 필요한 경우가 아니면 줄바꿈을 하지 마세요.
2. 문장이 중간에 끝나지 않았는데 줄바꿈된 경우, **무조건 한 줄로 이어서 정리**해주세요.
3. 문단 간 간격은 한 줄만 띄우고, 두 줄 이상 띄우지 마세요.
4. 결과는 깔끔한 마크다운 문서처럼 보여야 합니다.

다음은 요약할 원문입니다:
=======================
${webContent}
=======================
`;

			
			const summary = await generateContent(prompt);
			console.log('요약 완료');

			const cleanedText = summary
			.replace(/\n{3,}/g, '\n\n') // 3줄 이상 -> 2줄
			.replace(/([^\n])\n(?=[^\n])/g, (match, p1, offset, str) => {
				const before = str.slice(0, offset).split('\n').pop();
				const after = str.slice(offset).split('\n')[0];

 				const isMarkdownLine =
  			   	/^( {0,3}[-*+] |#{1,6} |```| {4})/.test(before) ||
  			    /^( {0,3}[-*+] |#{1,6} |```| {4})/.test(after);
  				return isMarkdownLine ? match : `${p1} `;
  			});

			marked.setOptions({ breaks: false })
			// 마크다운을 HTML로 변환
			const htmlContent = marked.parse(cleanedText);
			summaryContainer.innerHTML = htmlContent;
		} catch (error) {
			console.error('요약 중 오류 발생:', error);
			summaryContainer.innerHTML = `<p style="color: red;">오류가 발생했습니다: ${error.message}</p>`;
		} finally {
			loadingElement.style.display = 'none';
		}
	});
});

// putContentInSummary();
