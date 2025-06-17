chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'togglePopup') {
		console.log('Popup 상태 변경 요청 받음');

		// ✅ iframe 요소 찾기
		let iframe = document.querySelector('.popup');

		if (!iframe) {
			// ✅ iframe이 없으면 새로 생성
			iframe = document.createElement('iframe');
			iframe.src = chrome.runtime.getURL('popup.html');
			iframe.style.position = 'fixed';
			iframe.style.top = '100px'; // 초기 위치 (중앙이 아님)
			iframe.style.left = '100px'; // 초기 위치 (중앙이 아님)
			iframe.style.zIndex = '9999';
			iframe.style.border = 'none';
			iframe.style.display = 'none';
			iframe.classList.add('popup');
			document.body.appendChild(iframe);

			// ✅ 드래그 기능 추가
			makeDraggable(iframe);

			// ✅ 크기 자동 조정 기능 추가
			iframe.onload = () => adjustIframeSize(iframe);
		}

		// ✅ iframe 보이기/숨기기 토글
		const isVisible = iframe.style.display === 'block';
		iframe.style.display = isVisible ? 'none' : 'block';

		// ✅ 상태 저장
		chrome.storage.local.set({ popupAppearence: !isVisible }, () => {
			console.log('popupAppearence 값 변경:', !isVisible);
			sendResponse({ popupAppearence: !isVisible });
		});

		return true; // sendResponse를 비동기적으로 실행할 경우 반드시 true 반환
	}

	if (message.action === 'getPageContent') {
		const content = extractPageContent();
		sendResponse(content);
		return true;
	}
});

/**
 * iframe을 드래그 가능하게 만드는 함수
 */
function makeDraggable(iframe) {
	let offsetX,
		offsetY,
		isDragging = false;

	iframe.addEventListener('mousedown', e => {
		isDragging = true;

		offsetX = e.clientX - iframe.getBoundingClientRect().left;
		offsetY = e.clientY - iframe.getBoundingClientRect().top;

		iframe.style.cursor = 'grabbing';

		e.preventDefault();
	});

	document.addEventListener('mousemove', e => {
		if (!isDragging) return;

		let x = e.clientX - offsetX;
		let y = e.clientY - offsetY;

		iframe.style.left = `${x}px`;
		iframe.style.top = `${y}px`;
		iframe.style.transform = 'none';
	});

	document.addEventListener('mouseup', () => {
		isDragging = false;
		iframe.style.cursor = 'grab';
	});
}

/**
 * iframe 크기를 내부 콘텐츠 크기에 맞게 조정
 */
function adjustIframeSize(iframe) {
	const updateSize = () => {
		if (iframe.contentWindow) {
			const doc = iframe.contentWindow.document;
			if (doc.body) {
				iframe.style.width = doc.body.scrollWidth + 'px';
				iframe.style.height = doc.body.scrollHeight + 'px';
			}
		}
	};

	// iframe 내부 문서가 로드될 때 크기 조정
	iframe.onload = updateSize;

	// 크기 변경 감지
	const observer = new MutationObserver(updateSize);
	if (iframe.contentDocument && iframe.contentDocument.body) {
		observer.observe(iframe.contentDocument.body, {
			childList: true,
			subtree: true,
			attributes: true,
		});
	}
}

// 웹페이지 내용 추출 함수
function extractPageContent() {
	// 메타 태그에서 설명 가져오기
	const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
	
	// 주요 텍스트 내용 추출
	const article = document.querySelector('article') || document.body;
	const paragraphs = Array.from(article.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
		.map(element => element.textContent.trim())
		.filter(text => text.length > 0)
		.join('\n\n');

	// 제목 가져오기
	const title = document.title;

	return {
		title,
		description: metaDescription,
		content: paragraphs
	};
}
