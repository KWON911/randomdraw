# 팀/그룹 뽑기 (체육 수업용) 설계

날짜: 2026-08-09
대상 파일: `index.html` (단일 파일 앱)

## 배경 / 목적

체육 수업에서 반 학생을 여러 팀으로 나눌 때 쓰는 기능. 팀 간 실력 편차가 크게 벌어지지 않도록 학생별 "신체능력 등급(상/중/하)"을 고려해 팀을 자동 배분한다. 성별 균형도 선택적으로 함께 적용할 수 있어야 한다.

등급은 민감한 정보이므로, 참가자 명단 화면(홈 화면)이나 팀 배분 결과 화면에는 절대 노출하지 않는다. 등급은 교사만 보는 별도의 "등급 관리" 모달에서만 확인/수정한다.

## 데이터 모델

```js
// 참가자 객체 — 기존 {name, gender} 에 ability 필드 추가
{
  name: string,
  gender: 'M' | 'F' | null,
  ability: '상' | '중' | '하' | null
}

// state.settings 에 추가되는 팀 뽑기 전용 설정
teamSettings: {
  splitBy: 'count' | 'size',   // '팀 개수로 나누기' | '팀당 인원으로 나누기'
  teamCount: 4,                // splitBy === 'count' 일 때 사용
  teamSize: 4,                 // splitBy === 'size' 일 때 사용
  balanceGender: false,        // 성별 균형 배분 여부
  balanceAbility: false        // 신체능력 균형 배분 여부
}
```

- `DEFAULT_SETTINGS`에 `teamSettings` 기본값을 추가하고, 기존 `{ ...DEFAULT_SETTINGS, ...saved }` 병합 로직을 그대로 재사용한다.
- `migrateParticipants`는 문자열/기존 `{name, gender}` 객체를 받았을 때 `ability: null`을 채워 넣도록 확장한다.
- `gender-mode-select`(뽑기 대상)에 새 옵션 값 `'team'`을 추가한다. 기존 `'all' | 'M' | 'F' | 'alternate'`와 동일한 위치에서 관리된다.

## 등급 입력 경로

두 가지 입력 방법을 모두 지원한다.

1. **참가자 추가 폼**: 기존 `남/여` 토글 버튼 그룹 옆에 `상/중/하` 3단 토글 버튼 그룹을 추가한다(같은 시각 스타일, 폭은 더 좁게). 클릭 시 `selectedAbility` 상태를 토글하며, 제출 시 `state.participants.push({ name, gender: selectedGender, ability: selectedAbility })`로 저장한다. 제출 후 성별 토글과 마찬가지로 초기화된다.
2. **CSV 가져오기**: `extractParticipantsFromCSV`의 헤더 인식 로직에 등급 컬럼 인식을 추가한다.
   - 헤더 매칭: `등급`, `신체능력`, `ability` (대소문자 무관)
   - 값 매핑 테이블: `ABILITY_MAP = { '상': '상', '중': '중', '하': '하', 'high': '상', 'mid': '중', 'medium': '중', 'low': '하', 'h': '상', 'm': '중', 'l': '하' }`
   - 매칭 실패 값은 `null`.
   - 내보내기(`export-list`)에도 `등급` 컬럼을 추가해 왕복 가능하게 한다(등급 관리 화면에서 대량 수정 후 재가져오기 용도로도 쓰일 수 있음).

**중요**: 참가자 리스트(`renderParticipants`)의 각 `<li>`에는 성별 배지만 계속 렌더링하고, `ability` 값은 어떤 형태로도 표시하지 않는다.

## 등급 관리 모달 (신설)

- 오른쪽 "테마 & 설정" 패널에 `등급 관리` 버튼을 추가한다 (색상 선택 섹션 위 또는 배경 패턴 섹션 근처).
- 클릭 시 새 모달(`#ability-modal`)을 연다. 구조는 기존 `#import-modal`/`#confirm-modal`과 동일한 톤(흰 카드, 둥근 모서리, dark 지원).
- 모달 내용: 전체 참가자를 표 형태로 나열 — 이름, 성별(읽기전용 배지), 등급(`상/중/하/미지정` select 또는 3단 토글).
- 등급 select를 바꾸면 즉시 `state.participants`의 해당 항목을 갱신하고 `saveState('participants')` 호출 (자동 저장, 별도 "저장" 버튼 없음).
- 참가자가 없으면 "참가자가 없습니다" 안내 문구.
- 닫기 버튼만 존재 (변경 사항은 이미 즉시 저장됨).

## 팀 나누기 설정 UI

- `gender-mode-select`에 `<option value="team">팀 나누기</option>` 추가.
- `genderMode === 'team'`일 때, 기존 select 아래 영역(현재 비어있는 자리)에 팀 설정 패널을 조건부 렌더링:
  - **분배 기준 토글**: `팀 개수로` / `팀당 인원으로` 2단 버튼 토글 (성별 토글과 같은 스타일)
  - **숫자 입력**: `<input type="number" min="2">` — 토글 상태에 따라 `teamCount` 또는 `teamSize`를 바인딩
  - **체크박스 2개**: `☐ 성별 균형 배분`, `☐ 신체능력 균형 배분` — 각각 `teamSettings.balanceGender`/`balanceAbility`에 바인딩, 서로 독립적으로 켜고 끌 수 있음
- 이 상태에서 메인 뽑기 버튼(`#draw-btn`)의 라벨을 `팀 나누기 시작!`으로 교체한다 (JS로 `textContent` 변경, `genderMode` 변경 이벤트에서 처리).
- `toggle-exclude`(1회성 제외 모드) 체크박스는 `genderMode === 'team'`일 때 `disabled = true` 처리 (매번 전체 참가자로 재배분하는 것이 팀 나누기의 자연스러운 동작이므로).

## 배분 알고리즘

`runTeamDraw()`라는 새 함수로 구현하며 기존 `runDraw()`와는 분리한다 (두 기능은 결과 표현 방식이 다르므로 억지로 합치지 않는다).

1. `teamSettings.splitBy === 'size'`이면 `teamCount = Math.ceil(participants.length / teamSize)`로 환산. 그 외엔 `teamCount` 그대로 사용.
2. `teamCount < 2`이거나 `teamCount > participants.length`면 토스트로 에러 표시 후 중단.
3. 활성화된 균형 기준에 따라 참가자를 그룹(층)으로 분류:
   - `balanceGender && balanceAbility`: 키 = `${gender ?? '_'}-${ability ?? '_'}` (예: `M-상`, `_-중`, `F-_` 등)
   - `balanceGender`만: 키 = `gender ?? '_'`
   - `balanceAbility`만: 키 = `ability ?? '_'`
   - 둘 다 꺼짐: 그룹 없이 전체를 하나의 그룹으로 취급
4. 각 그룹 내부를 Fisher–Yates 셔플.
5. 그룹들을 (아무 고정 순서로, 예: Object.keys 순서) 순회하면서, 각 그룹의 멤버를 팀 인덱스에 라운드로빈으로 배정한다. 팀 인덱스 포인터는 그룹이 바뀌어도 리셋하지 않고 이어간다 — 특정 그룹이 항상 0번 팀부터 채워지는 편향을 방지하기 위함.
6. 결과: `teams = [{ name: '1팀', members: [...] }, ...]` (teamCount개, 이름은 `1팀, 2팀, ...` 숫자로 명명).

## 결과 화면

- 기존 `#result-overlay`를 재사용하되, 팀 모드일 때는 롤링 애니메이션 없이 즉시 팀 카드 그리드를 렌더링한다.
- `#result-name` 자리 대신 새 컨테이너(`#result-teams`, 팀 모드일 때만 표시/기존 개인 결과 요소는 숨김)에 팀별 카드(팀명 + 멤버 이름 목록, `이름만` 표시하고 등급/성별 배지 없음)를 그린다.
- 하단 버튼: `계속`(continue-draw, 팀 모드에서도 "다시 나누기" 의미로 재사용 가능 — 같은 설정으로 재배분) / `확인완료`(close-modal) 재사용. 추가로 `CSV 내보내기` 버튼을 결과 모달에 추가(팀,이름 형식 다운로드).

## 히스토리 기록

- `state.history`에 새 레코드 타입 추가:
  ```js
  { id, type: 'team', teamCount, date, dayKey }
  ```
- 기존 개인 당첨 레코드는 `type` 필드가 없으면 `'individual'`로 간주 (하위호환, 마이그레이션 불필요 — `getRecordDayKey` 등 기존 로직은 `type`과 무관하게 그대로 동작).
- `renderHistoryList`에서 `record.type === 'team'`이면 트로피 아이콘 대신 그룹 아이콘을 쓰고, `"N팀 배분 완료"` 한 줄만 표시.
- 히스토리 항목 클릭 시(신설 클릭 핸들러), 그 시점에 저장해둔 팀 배분 스냅샷을 결과 모달로 다시 열어 보여준다. 이를 위해 팀 히스토리 레코드에는 요약 정보 외에 `teams` 스냅샷도 함께 저장한다(요구사항의 "간단히 기록"은 리스트에 노출되는 표시가 간단하다는 의미이며, 재열람을 위해 데이터 자체는 저장):
  ```js
  { id, type: 'team', teamCount, date, dayKey, teams: [{ name, members: [string] }] }
  ```

## 예외 처리 정리

- 참가자 0~1명: `#draw-btn` 비활성화 (기존 로직 그대로, `genderMode`와 무관).
- 팀 설정 숫자 입력에 1 이하 또는 참가자 수 초과 값 입력 시, `input`/`change` 이벤트에서 즉시 clamp.
- 균형 배분을 체크했는데 등급/성별이 비어있는(`null`) 참가자가 섞여 있어도 에러 없이 `_`(미지정) 그룹으로 처리하고 조용히 진행한다.
- CSV 등급 컬럼이 없으면 전원 `ability: null`로 가져오기 (기존 동작과 동일하게 에러 없이 진행).

## 이번 스펙에서 제외하는 것 (YAGNI)

- 팀별 성비/등급 분포를 결과 화면에 보여주는 통계 뷰 — 필요해지면 별도 스펙으로.
- 팀 이름 커스터마이징(교사가 직접 "독수리팀" 등으로 이름 짓기) — 이번엔 `1팀, 2팀 ...` 고정.
- 등급 관리 모달에서의 CSV 일괄 내보내기(등급 포함) — 참가자 내보내기에 등급 컬럼을 추가하는 것으로 충분.
