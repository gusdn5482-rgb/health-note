// Exercise library for Health Note v3.
// Row format: [name, type, equipment, primary muscle, "secondary muscles", "aliases|..."]
// Types: wr = weight×reps, bw = bodyweight reps, bwp = bodyweight + added kg, bwa = assisted (−kg),
//        time = seconds, dist = km + time. Ids are "e:" + name and must stay stable.

export const MUSCLES = {
  chest: "가슴", lats: "광배근", upperback: "등 상부", traps: "승모근", lowback: "척추기립근",
  fdelt: "전면 어깨", sdelt: "측면 어깨", rdelt: "후면 어깨",
  biceps: "이두", triceps: "삼두", forearm: "전완",
  abs: "복근", oblique: "복사근",
  glutes: "둔근", quads: "대퇴사두", hams: "햄스트링", adductor: "내전근", calves: "종아리",
  cardio: "유산소"
};

export const PARTS = ["가슴", "등", "하체", "어깨", "팔", "코어", "유산소"];
export const MUSCLE_PART = {
  chest: "가슴", lats: "등", upperback: "등", traps: "등", lowback: "등",
  fdelt: "어깨", sdelt: "어깨", rdelt: "어깨", biceps: "팔", triceps: "팔", forearm: "팔",
  abs: "코어", oblique: "코어", glutes: "하체", quads: "하체", hams: "하체", adductor: "하체", calves: "하체",
  cardio: "유산소"
};
// Default primary muscle when a custom exercise is created from a body part.
export const PART_MUSCLE = { "가슴": "chest", "등": "lats", "하체": "quads", "어깨": "sdelt", "팔": "biceps", "코어": "abs", "유산소": "cardio" };

export const EQUIP = { barbell: "바벨", dumbbell: "덤벨", machine: "머신", cable: "케이블", smith: "스미스", bodyweight: "맨몸", kettlebell: "케틀벨", other: "기타" };
export const EQUIP_INC = { barbell: 2.5, smith: 2.5, dumbbell: 2, machine: 5, cable: 2.5, kettlebell: 4, bodyweight: 2.5, other: 2.5 };

export const TYPES = {
  wr: "중량 × 횟수", bw: "맨몸 횟수", bwp: "맨몸 + 추가 중량", bwa: "보조(어시스트)", time: "시간", dist: "거리 · 시간"
};

const ROWS = [
  // 가슴
  ["벤치프레스", "wr", "barbell", "chest", "triceps fdelt", "바벨 벤치프레스|플랫 벤치프레스|벤치 프레스"],
  ["인클라인 벤치프레스", "wr", "barbell", "chest", "fdelt triceps", "인클라인 바벨 벤치프레스"],
  ["디클라인 벤치프레스", "wr", "barbell", "chest", "triceps", ""],
  ["덤벨 벤치프레스", "wr", "dumbbell", "chest", "triceps fdelt", "덤벨 프레스|덤벨 체스트 프레스"],
  ["인클라인 덤벨 프레스", "wr", "dumbbell", "chest", "fdelt triceps", "인클라인 덤벨 벤치프레스"],
  ["스미스 벤치프레스", "wr", "smith", "chest", "triceps", ""],
  ["스미스 인클라인 프레스", "wr", "smith", "chest", "fdelt triceps", ""],
  ["체스트 프레스 머신", "wr", "machine", "chest", "triceps", "머신 체스트 프레스|체스트 프레스"],
  ["인클라인 체스트 프레스 머신", "wr", "machine", "chest", "fdelt", "인클라인 머신 프레스"],
  ["펙덱 플라이", "wr", "machine", "chest", "", "펙덱|버터플라이|머신 플라이"],
  ["덤벨 플라이", "wr", "dumbbell", "chest", "", ""],
  ["인클라인 덤벨 플라이", "wr", "dumbbell", "chest", "fdelt", ""],
  ["케이블 크로스오버", "wr", "cable", "chest", "", "케이블 플라이"],
  ["로우 케이블 플라이", "wr", "cable", "chest", "fdelt", ""],
  ["딥스", "bw", "bodyweight", "chest", "triceps fdelt", "체스트 딥스"],
  ["중량 딥스", "bwp", "bodyweight", "chest", "triceps fdelt", ""],
  ["어시스트 딥스", "bwa", "machine", "chest", "triceps", "어시스티드 딥스"],
  ["푸시업", "bw", "bodyweight", "chest", "triceps fdelt", "팔굽혀펴기|푸쉬업"],
  ["덤벨 풀오버", "wr", "dumbbell", "chest", "lats", ""],
  // 등
  ["데드리프트", "wr", "barbell", "lowback", "glutes hams traps", "컨벤셔널 데드리프트|바벨 데드리프트"],
  ["랙 풀", "wr", "barbell", "lowback", "traps glutes", "랙풀"],
  ["바벨 로우", "wr", "barbell", "lats", "upperback biceps rdelt", "벤트오버 로우|벤트 오버 로우"],
  ["펜들레이 로우", "wr", "barbell", "upperback", "lats biceps", ""],
  ["덤벨 로우", "wr", "dumbbell", "lats", "upperback biceps", "원암 덤벨 로우"],
  ["T바 로우", "wr", "machine", "upperback", "lats biceps", "티바 로우"],
  ["시티드 로우", "wr", "cable", "upperback", "lats biceps", "시티드 케이블 로우|케이블 로우"],
  ["머신 로우", "wr", "machine", "upperback", "lats biceps", "로우 머신|시티드 로우 머신"],
  ["랫풀다운", "wr", "cable", "lats", "biceps upperback", "랫 풀 다운|랫풀 다운"],
  ["원 암 랫풀다운", "wr", "cable", "lats", "biceps", "원암 랫풀다운"],
  ["클로즈 그립 랫풀다운", "wr", "cable", "lats", "biceps", "V바 랫풀다운"],
  ["암풀다운", "wr", "cable", "lats", "", "암풀 다운|스트레이트 암 풀다운"],
  ["풀업", "bw", "bodyweight", "lats", "biceps upperback", "턱걸이"],
  ["중량 풀업", "bwp", "bodyweight", "lats", "biceps upperback", ""],
  ["어시스트 풀업", "bwa", "machine", "lats", "biceps", "어시스티드 풀업|어시스트 풀업 머신"],
  ["친업", "bw", "bodyweight", "lats", "biceps", ""],
  ["인버티드 로우", "bw", "bodyweight", "upperback", "lats biceps", ""],
  ["바벨 슈러그", "wr", "barbell", "traps", "", "슈러그"],
  ["덤벨 슈러그", "wr", "dumbbell", "traps", "", ""],
  ["백 익스텐션", "bw", "bodyweight", "lowback", "glutes hams", "하이퍼 익스텐션"],
  ["중량 백 익스텐션", "bwp", "bodyweight", "lowback", "glutes hams", ""],
  ["굿모닝", "wr", "barbell", "hams", "lowback glutes", ""],
  // 하체
  ["스쿼트", "wr", "barbell", "quads", "glutes adductor lowback", "바벨 스쿼트|백 스쿼트"],
  ["프론트 스쿼트", "wr", "barbell", "quads", "glutes abs", ""],
  ["스미스 스쿼트", "wr", "smith", "quads", "glutes", ""],
  ["핵 스쿼트", "wr", "machine", "quads", "glutes", "핵스쿼트"],
  ["고블릿 스쿼트", "wr", "dumbbell", "quads", "glutes", ""],
  ["불가리안 스플릿 스쿼트", "wr", "dumbbell", "quads", "glutes", "불가리안 스쿼트"],
  ["레그 프레스", "wr", "machine", "quads", "glutes adductor", "레그프레스"],
  ["레그 익스텐션", "wr", "machine", "quads", "", "레그익스텐션"],
  ["라잉 레그 컬", "wr", "machine", "hams", "", "레그 컬|레그컬|라잉 레그컬"],
  ["시티드 레그 컬", "wr", "machine", "hams", "", ""],
  ["루마니안 데드리프트", "wr", "barbell", "hams", "glutes lowback", "RDL|루마니안"],
  ["덤벨 루마니안 데드리프트", "wr", "dumbbell", "hams", "glutes", ""],
  ["스티프 레그 데드리프트", "wr", "barbell", "hams", "lowback glutes", ""],
  ["스모 데드리프트", "wr", "barbell", "glutes", "quads adductor lowback", ""],
  ["런지", "wr", "dumbbell", "quads", "glutes", "덤벨 런지|워킹 런지"],
  ["바벨 런지", "wr", "barbell", "quads", "glutes", ""],
  ["힙 쓰러스트", "wr", "barbell", "glutes", "hams", "바벨 힙 쓰러스트|힙쓰러스트"],
  ["힙 쓰러스트 머신", "wr", "machine", "glutes", "hams", ""],
  ["글루트 브릿지", "bw", "bodyweight", "glutes", "hams", ""],
  ["케이블 킥백", "wr", "cable", "glutes", "", "힙 킥백"],
  ["힙 어브덕션", "wr", "machine", "glutes", "", "어브덕션|아웃타이"],
  ["힙 어덕션", "wr", "machine", "adductor", "", "어덕션|이너타이"],
  ["스탠딩 카프 레이즈", "wr", "machine", "calves", "", "카프 레이즈"],
  ["시티드 카프 레이즈", "wr", "machine", "calves", "", ""],
  ["스텝업", "wr", "dumbbell", "quads", "glutes", ""],
  ["피스톨 스쿼트", "bw", "bodyweight", "quads", "glutes", ""],
  ["맨몸 스쿼트", "bw", "bodyweight", "quads", "glutes", "에어 스쿼트"],
  // 어깨
  ["오버헤드 프레스", "wr", "barbell", "fdelt", "triceps sdelt", "OHP|밀리터리 프레스|바벨 숄더 프레스"],
  ["덤벨 숄더 프레스", "wr", "dumbbell", "fdelt", "triceps sdelt", "덤벨 오버헤드 프레스"],
  ["머신 숄더 프레스", "wr", "machine", "fdelt", "triceps sdelt", "머신 오버헤드 프레스|머신 오버해드 프레스|숄더 프레스 머신"],
  ["스미스 숄더 프레스", "wr", "smith", "fdelt", "triceps", ""],
  ["아놀드 프레스", "wr", "dumbbell", "fdelt", "sdelt triceps", ""],
  ["사이드 레터럴 레이즈", "wr", "dumbbell", "sdelt", "", "사레레|사이드 레이즈|레터럴 레이즈"],
  ["케이블 레터럴 레이즈", "wr", "cable", "sdelt", "", ""],
  ["머신 레터럴 레이즈", "wr", "machine", "sdelt", "", "사레레 머신|레터럴 레이즈 머신"],
  ["프론트 레이즈", "wr", "dumbbell", "fdelt", "", ""],
  ["벤트오버 레터럴 레이즈", "wr", "dumbbell", "rdelt", "upperback", "리어 델트 레이즈|벤트 오버 레터럴"],
  ["리버스 펙덱", "wr", "machine", "rdelt", "upperback", "후면 플라이|리어 델트 플라이|리버스 플라이"],
  ["페이스 풀", "wr", "cable", "rdelt", "upperback traps", "페이스풀"],
  ["업라이트 로우", "wr", "barbell", "sdelt", "traps", ""],
  ["랜드마인 프레스", "wr", "barbell", "fdelt", "chest triceps", ""],
  // 팔
  ["바벨 컬", "wr", "barbell", "biceps", "forearm", "바벨 바이셉스 컬"],
  ["EZ바 컬", "wr", "barbell", "biceps", "forearm", "이지바 컬"],
  ["덤벨 컬", "wr", "dumbbell", "biceps", "forearm", "덤벨 바이셉스 컬"],
  ["해머 컬", "wr", "dumbbell", "biceps", "forearm", ""],
  ["인클라인 덤벨 컬", "wr", "dumbbell", "biceps", "", ""],
  ["프리처 컬", "wr", "machine", "biceps", "", "프리쳐 컬"],
  ["케이블 컬", "wr", "cable", "biceps", "forearm", ""],
  ["컨센트레이션 컬", "wr", "dumbbell", "biceps", "", ""],
  ["트라이셉스 푸시다운", "wr", "cable", "triceps", "", "푸시다운|케이블 푸시다운|트라이셉 푸시다운|삼두 푸시다운"],
  ["로프 푸시다운", "wr", "cable", "triceps", "", ""],
  ["오버헤드 트라이셉스 익스텐션", "wr", "cable", "triceps", "", "오버헤드 익스텐션|케이블 오버헤드 익스텐션"],
  ["덤벨 오버헤드 익스텐션", "wr", "dumbbell", "triceps", "", ""],
  ["라잉 트라이셉스 익스텐션", "wr", "barbell", "triceps", "", "스컬 크러셔|라잉 익스텐션"],
  ["클로즈 그립 벤치프레스", "wr", "barbell", "triceps", "chest", ""],
  ["덤벨 킥백", "wr", "dumbbell", "triceps", "", "트라이셉스 킥백"],
  ["벤치 딥스", "bw", "bodyweight", "triceps", "", ""],
  ["리스트 컬", "wr", "barbell", "forearm", "", "손목 컬"],
  ["리버스 리스트 컬", "wr", "barbell", "forearm", "", ""],
  ["파머스 워크", "time", "dumbbell", "forearm", "traps abs", "파머스 캐리"],
  // 코어
  ["플랭크", "time", "bodyweight", "abs", "oblique", ""],
  ["사이드 플랭크", "time", "bodyweight", "oblique", "abs", ""],
  ["크런치", "bw", "bodyweight", "abs", "", ""],
  ["케이블 크런치", "wr", "cable", "abs", "", ""],
  ["행잉 레그 레이즈", "bw", "bodyweight", "abs", "oblique", ""],
  ["레그 레이즈", "bw", "bodyweight", "abs", "", "라잉 레그 레이즈"],
  ["앱 롤아웃", "bw", "other", "abs", "", "복근 롤러|AB 롤아웃"],
  ["러시안 트위스트", "bw", "bodyweight", "oblique", "abs", ""],
  ["싯업", "bw", "bodyweight", "abs", "", "윗몸일으키기"],
  ["데드버그", "bw", "bodyweight", "abs", "", ""],
  ["마운틴 클라이머", "time", "bodyweight", "abs", "quads", ""],
  // 유산소
  ["러닝머신", "dist", "machine", "cardio", "", "트레드밀|러닝"],
  ["실외 러닝", "dist", "other", "cardio", "", "달리기|조깅"],
  ["실내 사이클", "dist", "machine", "cardio", "", "사이클|자전거"],
  ["천국의 계단", "time", "machine", "cardio", "", "스텝밀"],
  ["로잉머신", "dist", "machine", "cardio", "lats", "로잉"],
  ["일립티컬", "time", "machine", "cardio", "", "크로스 트레이너"],
  ["걷기", "dist", "other", "cardio", "", "경사 걷기|인클라인 워킹"],
  ["줄넘기", "time", "other", "cardio", "", ""],
  ["버피", "bw", "bodyweight", "cardio", "quads chest", ""]
];

export const EXERCISES = ROWS.map(([name, type, equip, primary, secondary, aliases]) => ({
  id: "e:" + name, name, type, equip, primary,
  secondary: secondary ? secondary.split(" ") : [],
  aliases: aliases ? aliases.split("|") : [],
  custom: false
}));
