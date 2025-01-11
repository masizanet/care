const dbName = "WebAppDB";
const storeName = "DataStore";

// IndexedDB 초기화
function initDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, 1);

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
			}
		};

		request.onsuccess = (event) => resolve(event.target.result);
		request.onerror = (event) => reject(event.target.error);
	});
}

// 오늘 날짜를 기본값으로 설정
document.addEventListener("DOMContentLoaded", () => {
	const today = new Date().toISOString().split("T")[0];
	document.getElementById("dateInput").value = today;

	// 현재 시간을 기본값으로 설정
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	document.getElementById("timeInput").value = `${hours}:${minutes}`;
});


function isoToLocalTime(isoString) {
	const date = new Date(isoString);
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

function localTimeToISO(dateString, timeString) {
	const [hours, minutes] = timeString.split(':').map(Number);
	const date = new Date(dateString);
	date.setHours(hours, minutes, 0, 0);
	return date.toISOString();
}

function formatKoreanTime(isoString) {
	const options = {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZone: 'Asia/Seoul',
	};
	return new Intl.DateTimeFormat('ko-KR', options).format(new Date(isoString));
}

// 데이터 조회
async function fetchData() {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);

	const request = store.getAll();

	request.onsuccess = (event) => {
		const data = event.target.result;

		if (data.length === 0) {
			const dataList = document.getElementById("dataList");
			dataList.innerHTML = "<p>저장된 데이터가 없습니다.</p>";
			return;
		}

		const groupedData = data.reduce((acc, item) => {
			if (!acc[item.date]) acc[item.date] = [];
			acc[item.date].push(item);
			return acc;
		}, {});

		const dataList = document.getElementById("dataList");
		dataList.innerHTML = "";

		Object.keys(groupedData).sort().forEach((date) => {
			// 날짜 헤더
			const dateHeader = document.createElement("h3");
			dateHeader.textContent = `날짜: ${date}`;
			dataList.appendChild(dateHeader);

			// 총합 계산
			const totals = groupedData[date].reduce(
				(acc, item) => ({
					value1: acc.value1 + (item.value1 || 0),
					value2: acc.value2 + (item.value2 || 0),
					value3: acc.value3 + (item.value3 || 0),
					value4: acc.value4 + (item.value4 || 0),
				}),
				{ value1: 0, value2: 0, value3: 0, value4: 0 }
			);

			// 총합 표시
			const totalSummary = document.createElement("p");
			totalSummary.innerHTML = `
				<strong>합계:</strong> 
				소변: ${totals.value1}컵, 
				장루: ${totals.value2}컵, 
				물: ${totals.value3}컵, 
				걷기: ${totals.value4}분`;
			dataList.appendChild(totalSummary);

			// 상세 데이터 목록
			const dateList = document.createElement("ul");
			groupedData[date].forEach((item) => {
				const listItem = document.createElement("li");
				listItem.innerHTML = `
					<strong>시간:</strong> ${formatKoreanTime(item.timestamp)}
					<button onclick="editEntry(${item.id})">수정</button>
					<button onclick="deleteEntry(${item.id})">삭제</button><br>
					<strong>소변:</strong> ${item.value1 || "0"}컵 | 
					<strong>장루:</strong> ${item.value2 || "0"}컵 | 
					<strong>물:</strong> ${item.value3 || "0"}컵 | 
					<strong>걷기:</strong> ${item.value4 || "0"}분
					`;
				dateList.appendChild(listItem);
			});
			dataList.appendChild(dateList);
		});
	};

	request.onerror = (event) => {
		console.error("데이터 로드 실패:", event.target.error);
	};
}

// 데이터 저장
async function saveData(date, time, value1, value2, value3, value4) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);

	// 시간과 날짜를 ISO 형식으로 변환
	const timestamp = localTimeToISO(date, time);
	store.add({ date, value1, value2, value3, value4, timestamp });

	transaction.oncomplete = () => {
		alert("데이터가 저장되었습니다!");
		fetchData();
	};
}

// 데이터 수정
async function editEntry(id) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);

	const request = store.get(id);
	request.onsuccess = (event) => {
		const data = event.target.result;

		// 입력 필드에 기존 데이터 채우기
		document.getElementById("dateInput").value = data.date;
		document.getElementById("timeInput").value = isoToLocalTime(data.timestamp);
		document.getElementById("value1").value = data.value1 || 0;
		document.getElementById("value2").value = data.value2 || 0;
		document.getElementById("value3").value = data.value3 || 0;
		document.getElementById("value4").value = data.value4 || 0;

		// 기존 항목 삭제 후 수정 저장
		deleteEntry(id, false);
	};
}

async function deleteEntry(id, refresh = true) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);

	store.delete(id);

	transaction.oncomplete = () => {
		if (refresh) {
			alert("데이터가 삭제되었습니다.");
			fetchData(); // 목록 새로고침
		}
	};
}


// 데이터 내보내기 (CSV 형식)
async function exportDataAsCSV() {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);

	const request = store.getAll();
	request.onsuccess = (event) => {
		const data = event.target.result;

		// CSV 헤더와 데이터 생성
		const headers = ["id", "date", "content", "timestamp"];
		const rows = data.map((item) =>
			[item.id, item.date, item.content, item.timestamp].join(",")
		);
		const csvContent = [headers.join(","), ...rows].join("\n");

		// CSV 파일 생성 및 다운로드
		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "data.csv";
		a.click();

		URL.revokeObjectURL(url);
	};
}
// CSV 파일 불러오기
async function importDataFromCSV(file) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);

	const reader = new FileReader();
	reader.onload = (event) => {
		const csvContent = event.target.result;
		const rows = csvContent.split("\n").slice(1); // 첫 줄은 헤더
		rows.forEach((row) => {
			const [id, date, content, timestamp] = row.split(",");
			if (date && content) {
				store.add({ date, content, timestamp: timestamp || new Date().toISOString() });
			}
		});

		transaction.oncomplete = () => {
			console.log("CSV 데이터 불러오기 완료");
			fetchData(); // 새로고침
		};
	};
	reader.readAsText(file);
}


// 이벤트 리스너 등록
document.getElementById("dataForm").addEventListener("submit", (event) => {
	event.preventDefault();
	const date = document.getElementById("dateInput").value;
	let time = document.getElementById("timeInput").value;

	// 시간이 입력되지 않았으면 현재 시간으로 설정
	if (!time) {
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		time = `${hours}:${minutes}`;
	}

	const value1 = parseInt(document.getElementById("value1").value, 10) || null;
	const value2 = parseInt(document.getElementById("value2").value, 10) || null;
	const value3 = parseInt(document.getElementById("value3").value, 10) || null;
	const value4 = parseInt(document.getElementById("value4").value, 10) || null;

	// 적어도 하나의 값이 입력되었는지 확인
	if (value1 || value2 || value3 || value4) {
		saveData(date, time, value1, value2, value3, value4);
	} else {
		alert("적어도 하나의 값을 입력해야 합니다.");
	}
});

// 초기 데이터 로드
document.addEventListener("DOMContentLoaded", () => {
	fetchData();
});

document.getElementById("exportCSV").addEventListener("click", exportDataAsCSV);

document.getElementById("importForm").addEventListener("submit", (event) => {
	event.preventDefault();
	const fileInput = document.getElementById("csvFileInput");
	if (fileInput.files.length > 0) {
		importDataFromCSV(fileInput.files[0]);
	} else {
		alert("CSV 파일을 선택하세요.");
	}
});
