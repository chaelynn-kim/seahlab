import type { Equipment } from '../types'

export const LINE_NAME = '시험검사반'
export const SUPPORT_TEAM = '서포터즈'

export const EQUIPMENT_LIST: Equipment[] = [
  {
    id: 'q-fog',
    name: 'Q-FOG 염수분무기',
    shortName: 'Q-FOG',
    items: [
      { no: 1, point: '염수저장통', timing: '운', criteria: '30L 이상 유지', inputKind: 'number' },
      { no: 2, point: '증류수저장통', timing: '운', criteria: '⅓ 이상 유지', inputKind: 'fraction' },
      { no: 3, point: '염수분무', timing: '운', criteria: '염수 분무 상태 확인', inputKind: 'mark' },
      { no: 4, point: '압력조절기', timing: '운', criteria: '15 psi 이내 유지', inputKind: 'number' },
      { no: 5, point: '온도', timing: '운', criteria: '35℃ 이내 유지', inputKind: 'number' },
      { no: 6, point: '습도', timing: '운', criteria: '100% 유지', inputKind: 'number' },
      { no: 7, point: '공기포화기', timing: '정', criteria: '내부 오염 없을것', inputKind: 'mark' },
    ],
  },
  {
    id: 'vice',
    name: '굽힘 시험기 (VICE)',
    shortName: '바이스',
    items: [
      { no: 1, point: '때, 먼지, 부식상태', timing: '정', criteria: '사용 기능에 영향을 주는 이물질이 없을 것' },
      { no: 2, point: '스크류의 윤활상태', timing: '운', criteria: '기기 동작이 정상적이고, 적절한 윤활유를 유지할 것' },
      { no: 3, point: '동작 (밀착도) 상태', timing: '운', criteria: '바이스는 흔들림이 없고, 밀착상태가 양호할 것' },
    ],
  },
  {
    id: 'pencil-hardness',
    name: '연필경도시험',
    shortName: '연필경도',
    items: [
      { no: 1, point: '연필 홀더 상태', timing: '정', criteria: '연필 고정이 흔들림 없이 견고할 것' },
      { no: 2, point: '연필 심 상태', timing: '정', criteria: '마모, 깨짐 없이 일정한 경도 유지' },
      { no: 3, point: '하중추(무게추)', timing: '정', criteria: '규정하중(예:500g) 정확한 유지', inputKind: 'number' },
      { no: 4, point: '이동 슬라이드', timing: '운', criteria: '이동 시 걸림 없이 부드럽게 작동할 것' },
      { no: 5, point: '시험판 고정대', timing: '정', criteria: '시편 고정시 흔들림 없을것' },
      { no: 6, point: '시험 각도', timing: '정', criteria: '45˚ 유지' },
      { no: 7, point: '외관 및 오염', timing: '정', criteria: '먼지, 이물질 없이 청결 상태 유지' },
    ],
  },
  {
    id: 'impact',
    name: '충격시험기',
    shortName: '충격시험기',
    items: [
      { no: 1, point: '해머(추)상태', timing: '정', criteria: '균열, 마모 없이 정상상태' },
      { no: 2, point: '해머 상승/하강', timing: '운', criteria: '걸림 없이 부드럽게 작동' },
      { no: 3, point: '눈금자 (에너지표시)', timing: '정', criteria: '0점 정확, 표시값 이상 없음' },
      { no: 4, point: '시편 고정대', timing: '정', criteria: '시편 고정 시 흔들림 없을것' },
      { no: 5, point: '브레이크 장치', timing: '운', criteria: '해머 정지 정상 작동' },
      { no: 6, point: '안전커버', timing: '정', criteria: '개방 시 작동 불가 (인터락 정상)' },
      { no: 7, point: '베어링 및 축', timing: '운', criteria: '이상 소음, 진동 없을것' },
      { no: 8, point: '외관 및 오염', timing: '정', criteria: '오일, 이물질 없이 청결' },
    ],
  },
  {
    id: 'cutter-guide',
    name: 'CUTTER GUIDE',
    shortName: 'CUTTER GUIDE',
    items: [
      { no: 1, point: '표면 상태', timing: '정', criteria: '사용 기능에 영향을 주는 이물질이 없을 것' },
      { no: 2, point: '간격 상태', timing: '정', criteria: '간격 1mm으로 일정할 것' },
    ],
  },
  {
    id: 'erichsen',
    name: '에릭슨 시험기',
    shortName: '에릭슨',
    items: [
      { no: 1, point: '펀치(압입봉) 상태', timing: '정', criteria: '마모, 손상 없이 표면 양호' },
      { no: 2, point: '다이(받침 금형)', timing: '정', criteria: '균열, 찍힘 없이 정상상태' },
      { no: 3, point: '유압 압력계', timing: '운', criteria: '설정 압력 범위 내 유지' },
      { no: 4, point: '압입 속도', timing: '운', criteria: '일정 속도로 부드럽게 작동' },
      { no: 5, point: '시편 고정 장치', timing: '정', criteria: '시편 미끄러짐 없이 고정' },
      { no: 6, point: '측정 눈금/디지털 값', timing: '정', criteria: '표시값 정확' },
      { no: 7, point: '오일 상태', timing: '운', criteria: '누유 없음, 오일량 정상' },
      { no: 8, point: '안전장치', timing: '정', criteria: '비상정지 및 인터락 정상 작동' },
      { no: 9, point: '외관 및 청결', timing: '정', criteria: '이물질, 오염 없이 유지' },
    ],
  },
  {
    id: 'tape-measure',
    name: '줄자',
    shortName: '줄자',
    items: [
      { no: 1, point: '외관 및 오염', timing: '정', criteria: '녹, 이물질 없이 청결' },
      { no: 2, point: '측정 눈금 값', timing: '정', criteria: '눈금 정확할 것' },
    ],
  },
  {
    id: 'micrometer',
    name: '마이크로메타',
    shortName: '마이크로메타',
    items: [
      { no: 1, point: '외관 상태', timing: '정', criteria: '녹, 이물질 없이 청결' },
      { no: 2, point: '영점 상태', timing: '정', criteria: '눈금 0점에 위치할 것' },
      { no: 3, point: '측정면 상태', timing: '정', criteria: '앤빌 및 스핀들 측정면 손상 없을 것' },
      { no: 4, point: '작동 상태', timing: '정', criteria: '스핀들 회전이 원활하고 걸림 없이 정상 작동될 것' },
    ],
  },
  {
    id: 'electric-mirror',
    name: '전기식 지시거울',
    shortName: '지시거울',
    items: [
      { no: 1, point: '영점 상태', timing: '정', criteria: '눈금 0점에 위치할 것' },
    ],
  },
  {
    id: 'tensile',
    name: '인장 시험기',
    shortName: '인장',
    items: [
      { no: 1, point: '신율계', timing: '정', criteria: '오염물 없을 것' },
      { no: 2, point: '실린더', timing: '정', criteria: '오염물 없을 것, 눈금 0 에 셋팅' },
      { no: 3, point: '신율계 간격', timing: '정', criteria: '신율계 간격 50mm', inputKind: 'number' },
      { no: 4, point: '눈금자', timing: '정', criteria: 'PC 모니터 값과 동일할 것 (818)', inputKind: 'number' },
      { no: 5, point: '실린더 압력 조절기', timing: '운', criteria: '50~100 (bar)', inputKind: 'number' },
    ],
  },
  {
    id: 'arl',
    name: 'ARL 3460',
    shortName: 'ARL',
    items: [
      { no: 1, point: 'Air Filter', timing: '운', criteria: '오염도 70% ↓', inputKind: 'number' },
      { no: 2, point: 'Insulator', timing: '정', criteria: '오염물 없을 것' },
      { no: 3, point: 'Hard Metal Disc', timing: '정', criteria: '오염물 없을 것' },
      { no: 4, point: 'Electrode 0.5mm', timing: '정', criteria: '상태 양호할 것' },
      { no: 5, point: 'Vacuum Pump', timing: '운', criteria: 'Oil량 적정구간 확인' },
      { no: 7, point: 'Petrey Table Water Cooling Pump', timing: '운', criteria: 'Water ⅓ ↑', inputKind: 'fraction' },
    ],
  },
  {
    id: 'colorimeter',
    name: '색차계',
    shortName: '색차계',
    items: [
      { no: 1, point: '전원 상태', timing: '정', criteria: '전원 정상 작동, 배터리 부족 없음' },
      { no: 2, point: '외관 및 오염', timing: '정', criteria: '렌즈 및 측정부 먼지, 이물질 없을것' },
      { no: 3, point: '렌즈 상태', timing: '정', criteria: '스크래치, 오염 없이 깨끗할 것' },
      { no: 4, point: '백색표준판', timing: '정', criteria: '오염, 변색 없이 깨끗할 것' },
      { no: 5, point: '영점 보정', timing: '정', criteria: '측정 전 반드시 정상 보정 완료' },
      { no: 6, point: '표준값 확인', timing: '정', criteria: '기준 색상 측정 시 △E 허용범위 내 (△E ≤0.5)' },
      { no: 7, point: '측정 반복성', timing: '운', criteria: '동일 시편 반복 측정 시 편차 미미할 것' },
      { no: 8, point: '측정 헤드 밀착 상태', timing: '운', criteria: '시편과 완전 밀착, 빛 유입 없을 것' },
      { no: 9, point: '측정값 표시', timing: '운', criteria: 'L,A,B값 정상 표시(오류 없을 것)' },
      { no: 10, point: '이상유무 확인', timing: '정', criteria: '이상 발생 시 사용 중지 및 점검 요청' },
    ],
  },
  {
    id: 'oven',
    name: '자동 배출형 오븐',
    shortName: '오븐',
    items: [
      { no: 1, point: 'MOTOR', timing: '운', criteria: '진동' },
      { no: 2, point: '실린더', timing: '운', criteria: '오염물 없을 것' },
      { no: 3, point: '온도 컨트롤 디스플레이 창', timing: '운', criteria: '0-280℃ (280℃ 유지 확인)', inputKind: 'number' },
      { no: 4, point: '풍속 컨트롤러', timing: '운', criteria: '진동' },
    ],
  },
  {
    id: 'press',
    name: '100Ton 유압프레스',
    shortName: '프레스',
    items: [
      { no: 1, point: '유압 배관', timing: '운', criteria: 'LEAK가 없을 것' },
      { no: 2, point: 'MOTOR', timing: '운', criteria: '이상 진동, 발열 60℃ ↓', inputKind: 'number' },
      { no: 3, point: '시편 성형기', timing: '정', criteria: '오염물 없을 것' },
      { no: 4, point: '프레스 펀치', timing: '정', criteria: '오염물 없을 것' },
      { no: 5, point: '안전 가이드', timing: '정', criteria: '안전센서 작동 여부' },
      { no: 6, point: 'Oil Tank', timing: '운', criteria: 'Oil량 적정구간 확인' },
    ],
  },
  {
    id: 'coating-thickness',
    name: '무선 도막두께 측정기',
    shortName: '도막두께',
    items: [
      { no: 1, point: '때, 먼지, 정밀도', timing: '정', criteria: '측정값이 표준두께 시편과 일치할 것' },
    ],
  },
  {
    id: 'taper-gauge',
    name: '테이퍼 게이지',
    shortName: '테이퍼게이지',
    items: [
      { no: 1, point: '표면상태', timing: '정', criteria: '사용 기능에 영향을 주는 이물질이 없을 것' },
      { no: 2, point: '간격상태', timing: '정', criteria: '게이지의 간격이 일정할 것' },
    ],
  },
  {
    id: 'thermometer',
    name: '바이메탈 온도계',
    shortName: '온도계',
    items: [
      { no: 1, point: '외관상태', timing: '정', criteria: '외관에 파손, 변형이 없어 눈금 판독에 지장이 없을 것' },
      { no: 2, point: '지침상태', timing: '정', criteria: '지침이 걸림이나 흔들림 없이 정상적으로 작동할 것' },
    ],
  },
]

export function getEquipmentById(id: string): Equipment | undefined {
  return EQUIPMENT_LIST.find((item) => item.id === id)
}
