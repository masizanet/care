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

function createCalendar(year, month, selectedDate = null) {
	const calendarTable = document.getElementById("calendarTable").querySelector("tbody");
	calendarTable.innerHTML = ""; // 기존 달력 초기화

	const firstDay = new Date(year, month, 1).getDay();
	const lastDate = new Date(year, month + 1, 0).getDate();

	let row = document.createElement("tr");

	// 첫 번째 주의 빈 칸 추가
	for (let i = 0; i < firstDay; i++) {
		const emptyCell = document.createElement("td");
		row.appendChild(emptyCell);
	}

	// 날짜 채우기
	for (let date = 1; date <= lastDate; date++) {
		const fullDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
		const dateCell = document.createElement("td");
		dateCell.textContent = date;
		dateCell.className = "date-cell";

		// 현재 출력 중인 날짜 강조
		if (fullDate === selectedDate) {
			dateCell.classList.add("selected");
		}

		// 날짜 클릭 이벤트
		dateCell.onclick = () => {
			document.querySelectorAll(".date-cell").forEach((cell) => cell.classList.remove("selected"));
			dateCell.classList.add("selected");

			// 현재 출력 중인 날짜와 합계 업데이트
			loadDataForDate(fullDate);
			calculateSummary(fullDate);

			// 달력 감추기
			toggleCalendar();
		};

		row.appendChild(dateCell);

		// 한 주가 끝나면 새 행 추가
		if ((date + firstDay) % 7 === 0) {
			calendarTable.appendChild(row);
			row = document.createElement("tr");
		}
	}

	// 마지막 주의 빈 칸 추가
	while (row.children.length < 7) {
		const emptyCell = document.createElement("td");
		row.appendChild(emptyCell);
	}
	calendarTable.appendChild(row);
}

// 데이터 불러오기
async function loadDataForDate(date) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);

	const request = store.getAll();
	request.onsuccess = (event) => {
		const data = event.target.result.filter((item) => item.date === date);

		const tableBody = document.querySelector("#dataTable tbody");
		tableBody.innerHTML = "";

		data.forEach((item) => {
			// NaN 체크를 추가하여 값들을 안전하게 변환
			const value1 = parseFloat(item.value1) || 0;
			const value2 = parseFloat(item.value2) || 0;
			const value3 = parseFloat(item.value3) || 0;
			const value4 = parseInt(item.value4) || 0;

			const row = document.createElement("tr");
			row.innerHTML = `
                <td>${formatKoreanTime(item.timestamp)}</td>
                <td>${value1.toFixed(1)}</td>
                <td>${value2.toFixed(1)}</td>
                <td>${value3.toFixed(1)}</td>
                <td>${value4}</td>
                <td><button onclick="editEntry(${item.id})">수정</button> <button onclick="deleteEntry(${item.id})">삭제</button></td>
            `;
			tableBody.appendChild(row);
		});
	};
}

async function calculateSummary(date) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);

	const request = store.getAll();
	request.onsuccess = (event) => {
		const data = event.target.result.filter((item) => item.date === date);

		// 합계 계산 시 명시적으로 숫자형으로 변환하고, NaN 체크
		const totals = data.reduce(
			(acc, item) => ({
				value1: acc.value1 + (parseFloat(item.value1) || 0),
				value2: acc.value2 + (parseFloat(item.value2) || 0),
				value3: acc.value3 + (parseFloat(item.value3) || 0),
				value4: acc.value4 + (parseInt(item.value4) || 0),  // 여기를 수정
			}),
			{ value1: 0, value2: 0, value3: 0, value4: 0 }
		);

		const summaryTitle = document.getElementById("summaryTitle");
		const summaryContent = document.getElementById("summaryContent");

		summaryTitle.textContent = `${date} 합계 ▼`;
		summaryContent.innerHTML = `
            소변: ${totals.value1.toFixed(1)}컵, 
            장루: ${totals.value2.toFixed(1)}컵, 
            물: ${totals.value3.toFixed(1)}컵, 
            걷기: ${totals.value4}분
        `;
	};
}

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

		const groupedData = data.reduce((acc, item) => {
			if (!acc[item.date]) acc[item.date] = [];
			acc[item.date].push(item);
			return acc;
		}, {});

		Object.keys(groupedData).sort().forEach((date) => {
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

	// 값들을 명시적으로 숫자형으로 변환하고, NaN이나 undefined 처리
	const data = {
		date,
		timestamp,
		value1: parseFloat(value1) || 0,
		value2: parseFloat(value2) || 0,
		value3: parseFloat(value3) || 0,
		value4: parseInt(value4) || 0  // 정수형으로 확실하게 변환
	};

	store.add(data);

	transaction.oncomplete = () => {
		alert("데이터가 저장되었습니다!");
		loadDataForDate(date);
		calculateSummary(date);

		const tableBody = document.querySelector("#dataTable tbody");
		if (tableBody.children.length > 0) {
			tableBody.lastElementChild.classList.add("highlight");
			setTimeout(() => {
				tableBody.lastElementChild.classList.remove("highlight");
			}, 2000);
		}
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

		// 수정 버튼 클릭 시 기존 데이터를 삭제하고 새로 저장
		const saveButton = document.getElementById("saveButton");
		saveButton.onclick = async () => {
			// 기존 데이터 삭제
			await deleteEntry(id, false);

			// 새 데이터 저장
			const date = document.getElementById("dateInput").value;
			const time = document.getElementById("timeInput").value;
			const value1 = Number(document.getElementById("value1").value).toFixed(1) || null;
			const value2 = Number(document.getElementById("value2").value).toFixed(1) || null;
			const value3 = Number(document.getElementById("value3").value).toFixed(1) || null;
			const value4 = parseInt(document.getElementById("value4").value, 10) || null;

			await saveData(date, time, value1, value2, value3, value4);

			// 현재 날짜 데이터 다시 로드
			loadDataForDate(date);
			calculateSummary(date);

			alert("데이터가 수정되었습니다!");
		};
	};
}


async function deleteEntry(id, refresh = true) {
	const db = await initDB();
	const transaction = db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);

	store.get(id).onsuccess = (event) => {
		const data = event.target.result;
		const date = data.date;

		store.delete(id);

		transaction.oncomplete = () => {
			if (refresh) {
				alert("데이터가 삭제되었습니다!");

				// 현재 날짜 데이터 다시 로드
				loadDataForDate(date);
				calculateSummary(date);
			}
		};
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


function toggleCalendar() {
	const calendarContainer = document.getElementById("calendarContainer");
	const summaryTitle = document.getElementById("summaryTitle");

	if (calendarContainer.style.display === "none") {
		calendarContainer.style.display = "block";
		summaryTitle.textContent = summaryTitle.textContent.replace("▼", "▲");
	} else {
		calendarContainer.style.display = "none";
		summaryTitle.textContent = summaryTitle.textContent.replace("▲", "▼");
	}
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

	const value1 = Number(document.getElementById("value1").value).toFixed(1) || null;
	const value2 = Number(document.getElementById("value2").value).toFixed(1) || null;
	const value3 = Number(document.getElementById("value3").value).toFixed(1) || null;
	const value4 = parseInt(document.getElementById("value4").value, 10) || null;

	// 적어도 하나의 값이 입력되었는지 확인
	if (value1 || value2 || value3 || value4) {
		saveData(date, time, value1, value2, value3, value4);
	} else {
		alert("적어도 하나의 값을 입력해야 합니다.");
	}
});

function updateCalendarForDate(date) {
	const [year, month] = date.split("-").map(Number);
	createCalendar(year, month - 1, date); // 월은 0부터 시작
}

// 초기 데이터 로드
document.addEventListener("DOMContentLoaded", () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth();
	const selectedDate = today.toISOString().split("T")[0];

	// 달력 생성 시 오늘 날짜 강조
	createCalendar(year, month, selectedDate);

	// 오늘 날짜 데이터 로드 및 합계 계산
	loadDataForDate(selectedDate);
	calculateSummary(selectedDate);

	// 입력 필드 기본값 설정
	document.getElementById("dateInput").value = selectedDate;
	const hours = String(today.getHours()).padStart(2, '0');
	const minutes = String(today.getMinutes()).padStart(2, '0');
	document.getElementById("timeInput").value = `${hours}:${minutes}`;

	// 데이터 목록 초기화
	fetchData();
});

// document.getElementById("exportCSV").addEventListener("click", exportDataAsCSV);

// document.getElementById("importForm").addEventListener("submit", (event) => {
// 	event.preventDefault();
// 	const fileInput = document.getElementById("csvFileInput");
// 	if (fileInput.files.length > 0) {
// 		importDataFromCSV(fileInput.files[0]);
// 	} else {
// 		alert("CSV 파일을 선택하세요.");
// 	}
// });
