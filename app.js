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
});


// 데이터 저장
async function saveData(date, value1, value2, value3, value4) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);

	const timestamp = new Date().toISOString();
	store.add({ date, value1, value2, value3, value4, timestamp });

	transaction.oncomplete = () => {
		alert("데이터가 저장되었습니다!");
		fetchData();
	};
}

function formatKoreanDateTime(isoString) {
	const options = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZone: 'Asia/Seoul',
		timeZoneName: 'short',
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
			const dateHeader = document.createElement("h3");
			dateHeader.textContent = `날짜: ${date}`;
			dataList.appendChild(dateHeader);

			const dateList = document.createElement("ul");
			groupedData[date].forEach((item) => {
				const listItem = document.createElement("li");
				listItem.innerHTML = `
					<strong>저장 시각:</strong> ${formatKoreanDateTime(item.timestamp)}<br>
					<strong>소변:</strong> ${item.value1 || "0"}컵<br>
					<strong>장루:</strong> ${item.value2 || "0"}컵<br>
					<strong>물:</strong> ${item.value3 || "0"}컵<br>
					<strong>걷기:</strong> ${item.value4 || "0"}분`;
				dateList.appendChild(listItem);
			});
			dataList.appendChild(dateList);
		});
	};

	request.onerror = (event) => {
		console.error("데이터 로드 실패:", event.target.error);
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
	const value1 = parseInt(document.getElementById("value1").value, 10) || null;
	const value2 = parseInt(document.getElementById("value2").value, 10) || null;
	const value3 = parseInt(document.getElementById("value3").value, 10) || null;
	const value4 = parseInt(document.getElementById("value4").value, 10) || null;

	// 적어도 하나의 값이 입력되었는지 확인
	if (value1 || value2 || value3 || value4) {
		saveData(date, value1, value2, value3, value4);
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
