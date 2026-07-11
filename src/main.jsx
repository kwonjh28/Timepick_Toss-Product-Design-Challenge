import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DAYS = ['월', '화', '수', '목', '금'];
const DAY_DATES = ['7/13', '7/14', '7/15', '7/16', '7/17'];
const TIMES = Array.from({ length: 18 }, (_, index) => {
  const startMinutes = 9 * 60 + index * 30;
  const endMinutes = startMinutes + 30;
  const format = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };
  return `${format(startMinutes)} - ${format(endMinutes)}`;
});

const PEOPLE = [
  { id: 'me', name: 'Tate (Product Designer)', required: true },
  { id: 't1', name: 'Min (Product Owner)', required: true },
  { id: 't2', name: 'Leo (Frontend Developer)', required: true },
  { id: 't3', name: 'David (Backend Developer)', required: true },
  { id: 't4', name: 'Chloe (Data Analyst)', required: false },
  { id: 't5', name: 'Sally (UX Writer)', required: false }
];

const PALETTE = {
  unavailable: {
    id: 'unavailable',
    label: '참여 불가',
    short: '불가',
    score: 2,
    color: '#ef4444',
    soft: '#fee2e2',
    cell: 'rgba(254, 226, 226, 0.55)',
    text: '#991b1b'
  },
  flexible: {
    id: 'flexible',
    label: '불가하나, 조정 여지 있음',
    short: '조정',
    score: 2,
    color: '#f97316',
    soft: '#ffedd5',
    cell: 'rgba(255, 237, 213, 0.68)',
    text: '#9a3412'
  },
  available: {
    id: 'available',
    label: '가능',
    short: '가능',
    score: 3,
    color: '#facc15',
    soft: '#fef9c3',
    cell: 'rgba(254, 249, 195, 0.76)',
    text: '#854d0e'
  },
  prefer: {
    id: 'prefer',
    label: '선호',
    short: '선호',
    score: 4,
    color: '#22c55e',
    soft: '#dcfce7',
    cell: 'rgba(220, 252, 231, 0.72)',
    text: '#166534'
  }
};

const STEP_COPY = {
  1: '참여가 어려운 일정을 클릭하거나 드래그하여 지정해주세요.',
  2: '선호도에 맞게 일정을 지정해주세요.',
  3: '필수 참가자 모두가 가능하면서도 선호도가 높은 시간대를 골라드렸어요.'
};

const STEP_LABELS = ['불가 일정 선택', '가능 일정 선택', '결과 확인'];

const BRUSH_ORDER = ['unavailable', 'flexible', 'available', 'prefer'];
const INITIAL_SUBMITTED_IDS = ['t1', 't2', 't3'];
const STEP_TWO_SUBMITTED_IDS = ['t4', 't5'];

const TEAM_AVAILABLE_RANGES = {
  0: [[2, 7], [12, 13]],
  1: [[4, 9], [15, 17]],
  2: [[0, 4], [10, 12]],
  3: [[5, 10], [14, 15]],
  4: [[2, 5], [8, 9], [13, 16]]
};

const RESULT_AVAILABLE_RANGES = {
  0: [[2, 4]],
  1: [[4, 7]],
  2: [[10, 11]],
  3: [[5, 6]]
};

const isKeyInRanges = (key, ranges) => {
  const [dayIndex, timeIndex] = key.split('-').map(Number);
  return ranges[dayIndex]?.some(([start, end]) => timeIndex >= start && timeIndex <= end);
};

const isTeamAvailableCandidate = (key) => isKeyInRanges(key, TEAM_AVAILABLE_RANGES);
const isResultCandidate = (key) => isKeyInRanges(key, RESULT_AVAILABLE_RANGES);

const cellKey = (day, time) => `${day}-${time}`;
const allKeys = () => DAYS.flatMap((_, day) => TIMES.map((__, time) => cellKey(day, time)));
const formatSlotTime = (timeIndex) => {
  const minutes = 9 * 60 + timeIndex * 30;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const formatRange = (startIndex, endIndex) => `${formatSlotTime(startIndex)}-${formatSlotTime(endIndex + 1)}`;
const TIME_MARKERS = Array.from({ length: 10 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`);
const normalizeStepTwoBrush = (brush) => (brush === 'prefer' ? 'prefer' : 'available');
const hasAdjacentOpenSlot = (key, blockedSlots) => {
  const [dayIndex, timeIndex] = key.split('-').map(Number);
  const previousKey = timeIndex > 0 ? cellKey(dayIndex, timeIndex - 1) : null;
  const nextKey = timeIndex < TIMES.length - 1 ? cellKey(dayIndex, timeIndex + 1) : null;
  return (
    (previousKey && !blockedSlots.has(previousKey)) ||
    (nextKey && !blockedSlots.has(nextKey))
  );
};
const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분 ${remainingSeconds}초`;
  return `${minutes}분 ${remainingSeconds}초`;
};

function seededPick(seed, options) {
  const x = Math.sin(seed * 999) * 10000;
  return options[Math.floor((x - Math.floor(x)) * options.length)];
}

function buildTeamFixedBlocks() {
  const blocks = {};
  PEOPLE.slice(1).forEach((person) => {
    blocks[person.id] = new Set();
  });

  const requiredPeople = PEOPLE.slice(1).filter((person) => person.required);
  allKeys().filter((key) => !isTeamAvailableCandidate(key)).forEach((key, index) => {
    blocks[requiredPeople[index % requiredPeople.length].id].add(key);
  });

  PEOPLE.slice(1)
    .filter((person) => !person.required)
    .forEach((person, personIndex) => {
      allKeys()
        .filter((key) => !isResultCandidate(key))
        .map((key, index) => ({
          key,
          weight: Math.abs(Math.sin((personIndex + 8) * (index + 5) * 1.41))
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 6)
        .forEach(({ key }) => blocks[person.id].add(key));
  });
  return blocks;
}

function buildTeammateData(blockedKeys, teamFixedBlocks) {
  const data = {};
  PEOPLE.slice(1).forEach((person, personIndex) => {
    data[person.id] = {};
    allKeys().forEach((key, index) => {
      if (blockedKeys.has(key) || teamFixedBlocks[person.id]?.has(key)) {
        data[person.id][key] = 'unavailable';
        return;
      }
      if (isResultCandidate(key)) {
        data[person.id][key] = seededPick((personIndex + 2) * (index + 7), ['available', 'prefer', 'prefer']);
        return;
      }
      const choices = ['flexible', 'available', 'available', 'prefer', 'prefer'];
      const weekendBias = index % 5 === 4 ? ['available', 'prefer', 'prefer'] : choices;
      data[person.id][key] = seededPick((personIndex + 2) * (index + 7), weekendBias);
    });
  });
  return data;
}

function App() {
  const [hasEnteredScheduler, setHasEnteredScheduler] = useState(false);
  const [participantName, setParticipantName] = useState('Tate (Product Designer)');
  const [step, setStep] = useState(1);
  const [requiredAttendance, setRequiredAttendance] = useState(true);
  const [selectedBrush, setSelectedBrush] = useState('unavailable');
  const [fixedBlocks, setFixedBlocks] = useState({});
  const [preferences, setPreferences] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [waitingTargetStep, setWaitingTargetStep] = useState(null);
  const [submittedPeople, setSubmittedPeople] = useState(new Set(INITIAL_SUBMITTED_IDS));
  const [tooltip, setTooltip] = useState(null);
  const [writingDotCount, setWritingDotCount] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(8263);
  const [selectedResultId, setSelectedResultId] = useState(null);
  const boardRef = useRef(null);
  const dragActionRef = useRef('paint');
  const hasFixedBlocks = Object.keys(fixedBlocks).length > 0;

  const requiredBlocked = useMemo(() => {
    return new Set(
      Object.entries(fixedBlocks)
        .filter(([, value]) => value.required)
        .map(([key]) => key)
    );
  }, [fixedBlocks]);

  const teamFixedBlocks = useMemo(() => buildTeamFixedBlocks(), []);

  const teamRequiredBlocked = useMemo(() => {
    const blocked = new Set();
    PEOPLE.slice(1)
      .filter((person) => person.required)
      .forEach((person) => {
        teamFixedBlocks[person.id].forEach((key) => blocked.add(key));
      });
    return blocked;
  }, [teamFixedBlocks]);

  const disabledSlots = useMemo(() => {
    return new Set([...requiredBlocked, ...teamRequiredBlocked]);
  }, [requiredBlocked, teamRequiredBlocked]);

  const meetingDisabledSlots = useMemo(() => {
    const blocked = new Set(disabledSlots);
    let changed = true;
    while (changed) {
      changed = false;
      allKeys().forEach((key) => {
        if (blocked.has(key)) return;
        if (!hasAdjacentOpenSlot(key, blocked)) {
          blocked.add(key);
          changed = true;
        }
      });
    }
    return blocked;
  }, [disabledSlots]);

  const teamData = useMemo(
    () => buildTeammateData(requiredBlocked, teamFixedBlocks),
    [requiredBlocked, teamFixedBlocks]
  );

  useEffect(() => {
    const stopDrag = () => setIsDragging(false);
    window.addEventListener('mouseup', stopDrag);
    return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setWritingDotCount((count) => (count === 3 ? 1 : count + 1));
    }, 420);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!waiting) return undefined;
    const transitionTimer = setTimeout(() => {
      if (waitingTargetStep === 3) {
        setSubmittedPeople(new Set(PEOPLE.map((person) => person.id)));
        setSelectedBrush(null);
        setSelectedResultId(null);
        setWaiting(false);
        setWaitingTargetStep(null);
        setStep(3);
        setTooltip(null);
        return;
      }
      const defaults = {};
      allKeys().forEach((key) => {
        if (!meetingDisabledSlots.has(key)) defaults[key] = 'available';
      });
      setPreferences(defaults);
      setSelectedBrush('prefer');
      setSelectedResultId(null);
      setSubmittedPeople(new Set(STEP_TWO_SUBMITTED_IDS));
      setWaiting(false);
      setWaitingTargetStep(null);
      setStep(2);
    }, 4000);
    return () => clearTimeout(transitionTimer);
  }, [waiting, waitingTargetStep, meetingDisabledSlots, fixedBlocks]);

  const getDragAction = (key) => {
    if (step === 1) return fixedBlocks[key] ? 'clear' : 'paint';
    const currentBrush = normalizeStepTwoBrush(preferences[key]);
    return currentBrush === selectedBrush && selectedBrush !== 'available' ? 'clear' : 'paint';
  };

  const paintCell = (key, action = dragActionRef.current) => {
    if (waiting || step === 3) return;
    if (step === 1) {
      setFixedBlocks((current) => {
        if (action === 'clear') {
          const next = { ...current };
          delete next[key];
          return next;
        }
        return {
          ...current,
          [key]: { brush: selectedBrush, required: requiredAttendance }
        };
      });
      return;
    }
    if (meetingDisabledSlots.has(key)) return;
    setPreferences((current) => {
      return { ...current, [key]: action === 'clear' ? 'available' : normalizeStepTwoBrush(selectedBrush) };
    });
  };

  const handleMouseDown = (key) => {
    setIsDragging(true);
    const action = getDragAction(key);
    dragActionRef.current = action;
    paintCell(key, action);
  };

  const handleCellMouseDown = (key) => {
    if (step === 3) {
      const selectedWindow = topOneHourResultWindows.find((window) => window.keys.includes(key));
      if (selectedWindow) setSelectedResultId(selectedWindow.id);
      return;
    }
    handleMouseDown(key);
  };

  const handleMouseEnter = (key) => {
    if (isDragging) paintCell(key);
  };

  const handleComplete = () => {
    if (step === 3) return;
    if (step === 1 && !hasFixedBlocks) return;
    if (step === 1) {
      setSubmittedPeople(new Set(['me', ...INITIAL_SUBMITTED_IDS]));
      setWaitingTargetStep(2);
      setWaiting(true);
      return;
    }
    setSubmittedPeople(new Set(['me', ...STEP_TWO_SUBMITTED_IDS]));
    setWaitingTargetStep(3);
    setWaiting(true);
    setTooltip(null);
  };

  const handleEditWaiting = () => {
    setWaiting(false);
    setWaitingTargetStep(null);
    setSelectedResultId(null);
    setSubmittedPeople(new Set(step === 1 ? INITIAL_SUBMITTED_IDS : STEP_TWO_SUBMITTED_IDS));
  };

  const getMyBrushForResult = (key) => {
    if (requiredBlocked.has(key)) return 'unavailable';
    return preferences[key] || 'available';
  };

  const isPersonRequired = (person) => (person.id === 'me' ? requiredAttendance : person.required);

  const resultRows = useMemo(() => {
    const rows = {};
    allKeys().forEach((key) => {
      const entries = PEOPLE.map((person) => {
        const personRequired = isPersonRequired(person);
        const brush = person.id === 'me' ? getMyBrushForResult(key) : teamData[person.id][key];
        const score = PALETTE[brush].score;
        const attendable = brush !== 'unavailable' || !personRequired;
        return { person, personRequired, brush, score, attendable };
      });
      rows[key] = {
        entries,
        total: entries.reduce((sum, entry) => sum + entry.score, 0),
        requiredCount: entries.filter((entry) => entry.personRequired && entry.attendable).length,
        optionalCount: entries.filter((entry) => !entry.personRequired && entry.attendable).length
      };
    });
    return rows;
  }, [preferences, requiredBlocked, requiredAttendance, teamData]);

  const hasResultBlockingIssue = (key) => {
    return (
      !isResultCandidate(key) ||
      meetingDisabledSlots.has(key) ||
      resultRows[key].entries.some((entry) => entry.brush === 'unavailable' || entry.brush === 'flexible')
    );
  };

  const isResultDisabled = (key) => {
    if (hasResultBlockingIssue(key)) return true;
    return !hasAdjacentOpenSlot(key, {
      has: (targetKey) => hasResultBlockingIssue(targetKey)
    });
  };

  const topOneHourResultWindows = useMemo(() => {
    const windows = [];
    DAYS.forEach((_, dayIndex) => {
      for (let timeIndex = 0; timeIndex < TIMES.length - 1; timeIndex += 1) {
        const firstKey = cellKey(dayIndex, timeIndex);
        const secondKey = cellKey(dayIndex, timeIndex + 1);
        if (isResultDisabled(firstKey) || isResultDisabled(secondKey)) continue;
        windows.push({
          id: `${dayIndex}-${timeIndex}`,
          dayIndex,
          start: timeIndex,
          end: timeIndex + 1,
          keys: [firstKey, secondKey],
          score: resultRows[firstKey].total + resultRows[secondKey].total,
          attendeeCount: PEOPLE.filter((person) => {
            return [firstKey, secondKey].every((key) => {
              const entry = resultRows[key].entries.find((item) => item.person.id === person.id);
              return entry?.attendable;
            });
          }).length,
          label: `2026년 7월 ${13 + dayIndex}일 ${formatRange(timeIndex, timeIndex + 1)}`
        });
      }
    });

    const usedKeys = new Set();
    const selectedWindows = [];
    windows
      .sort((a, b) => b.score - a.score)
      .forEach((window) => {
        if (selectedWindows.length >= 3) return;
        if (window.keys.some((key) => usedKeys.has(key))) return;
        selectedWindows.push(window);
        window.keys.forEach((key) => usedKeys.add(key));
      });
    return selectedWindows;
  }, [resultRows, meetingDisabledSlots]);

  const topOneHourResultKeys = useMemo(() => {
    return new Set(topOneHourResultWindows.flatMap((window) => window.keys));
  }, [topOneHourResultWindows]);

  const selectedResultWindow = useMemo(() => {
    return topOneHourResultWindows.find((window) => window.id === selectedResultId) || null;
  }, [topOneHourResultWindows, selectedResultId]);

  const optionalUnavailableByResultId = useMemo(() => {
    const patterns = [[], ['t4'], ['t4', 't5']];
    return topOneHourResultWindows.reduce((map, window, index) => {
      map[window.id] = patterns[index % patterns.length];
      return map;
    }, {});
  }, [topOneHourResultWindows]);

  const getDisplayedAttendeeCount = (window) => {
    const unavailableOptionalCount = (optionalUnavailableByResultId[window.id] || []).filter((personId) => {
      const person = PEOPLE.find((item) => item.id === personId);
      return person && !isPersonRequired(person);
    }).length;
    return Math.max(0, window.attendeeCount - unavailableOptionalCount);
  };

  const getDisplayedAttendanceLabel = (window) => {
    const unavailableCount = PEOPLE.length - getDisplayedAttendeeCount(window);
    return unavailableCount === 0 ? '전원참석' : `${unavailableCount}명 참여불가`;
  };

  const isUnavailableOptionalForSelectedResult = (person) => {
    if (step !== 3 || !selectedResultWindow || isPersonRequired(person)) return false;
    const unavailableIds = optionalUnavailableByResultId[selectedResultWindow.id] || [];
    return unavailableIds.includes(person.id);
  };

  const rangeLabels = useMemo(() => {
    const labels = [];
    DAYS.forEach((_, dayIndex) => {
      let start = null;
      let currentBrush = null;
      const flush = (endIndex) => {
        if (start === null || currentBrush === null) return;
        if (step === 3 && endIndex - start + 1 < 2) {
          start = null;
          currentBrush = null;
          return;
        }
        labels.push({
          id: `${dayIndex}-${start}-${endIndex}-${currentBrush}`,
          dayIndex,
          start,
          end: endIndex,
          text: formatRange(start, endIndex),
          brush: currentBrush
        });
        start = null;
        currentBrush = null;
      };
      TIMES.forEach((_, timeIndex) => {
        const key = cellKey(dayIndex, timeIndex);
        const brush = (() => {
          if (step === 1) return fixedBlocks[key]?.brush || null;
          if (step === 3) {
            if (isResultDisabled(key)) return null;
            return topOneHourResultKeys.has(key) ? 'result-top' : 'result';
          }
          if (meetingDisabledSlots.has(key)) return null;
          return normalizeStepTwoBrush(preferences[key]);
        })();
        if (brush && brush === currentBrush) return;
        flush(timeIndex - 1);
        if (brush) {
          start = timeIndex;
          currentBrush = brush;
        }
      });
      flush(TIMES.length - 1);
    });
    return labels;
  }, [step, fixedBlocks, preferences, meetingDisabledSlots, resultRows, topOneHourResultKeys]);

  const renderCellStyle = (key) => {
    if (step === 1) {
      const block = fixedBlocks[key];
      return block
        ? { background: PALETTE[block.brush].cell, borderColor: '#e6edf5' }
        : {};
    }
    if (step === 2) {
      if (meetingDisabledSlots.has(key)) return { background: '#d7dce6' };
      const brush = normalizeStepTwoBrush(preferences[key]);
      return { background: PALETTE[brush].cell, borderColor: '#e6edf5' };
    }
    if (isResultDisabled(key)) return { background: '#d7dce6' };
    const alpha = topOneHourResultKeys.has(key) ? 0.55 : 0.2;
    return {
      background: `rgba(49, 130, 246, ${alpha})`,
      borderColor: '#e6edf5',
      color: '#172033'
    };
  };

  const paletteItems = step === 1
    ? ['unavailable', 'flexible']
    : ['unavailable', 'flexible', 'available', 'prefer'];

  if (!hasEnteredScheduler) {
    return (
      <main className="app-shell intro-shell">
        <section className="intro-card" aria-label="타임픽 초대">
          <div className="intro-content">
            <div className="intro-heading">
              <h1>김정현님이 초대한 타임픽에 초대되셨습니다.</h1>
              <p>7월 셋째주 회의시간 정하기</p>
              <span>7.13(월) - 7.17(금)</span>
            </div>

            <div className="intro-form">
              <label className="intro-field">
                <span>참여자명</span>
                <input
                  type="text"
                  value={participantName}
                  onChange={(event) => setParticipantName(event.target.value)}
                  aria-label="참여자명"
                />
              </label>

              <div className="intro-required" role="radiogroup" aria-label="필수 참석자 여부">
                <p>필수 참석자신가요?</p>
                <div>
                  <button
                    type="button"
                    className={requiredAttendance ? 'selected' : ''}
                    role="radio"
                    aria-checked={requiredAttendance}
                    onClick={() => setRequiredAttendance(true)}
                  >
                    네
                  </button>
                  <button
                    type="button"
                    className={!requiredAttendance ? 'selected' : ''}
                    role="radio"
                    aria-checked={!requiredAttendance}
                    onClick={() => setRequiredAttendance(false)}
                  >
                    아니요
                  </button>
                </div>
              </div>
            </div>

            <button
              className="intro-next-button"
              type="button"
              disabled={!participantName.trim()}
              onClick={() => setHasEnteredScheduler(true)}
            >
              다음
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="scheduler">
        <header className="topbar">
          <div>
            <p className="eyebrow">Step{step}</p>
            <h1>{STEP_COPY[step]}</h1>
          </div>
          <div className={`stepper step-${step}`} aria-label="진행 단계">
            {[1, 2, 3].map((value, index) => (
              <div key={value} className="stepper-item">
                <span className={step === 3 ? 'done' : value === step ? 'active' : value < step ? 'done' : ''}>
                  {value}
                </span>
                <small>{STEP_LABELS[index]}</small>
              </div>
            ))}
          </div>
        </header>

        <div className="workspace">
          <section className="board-wrap">
            <div ref={boardRef} className={`board ${waiting ? 'is-waiting' : ''}`}>
              <div className="grid header-grid">
                <div className="corner" />
                {DAYS.map((day, index) => (
                  <div className="day-heading" key={day}>
                    <strong>{day}</strong>
                    <small>{DAY_DATES[index]}</small>
                  </div>
                ))}
              </div>
              <div className="grid body-grid">
                {TIMES.map((time, timeIndex) => (
                  <React.Fragment key={time}>
                    <div className={`time-label ${timeIndex % 2 === 1 ? 'half' : ''}`}>
                      {timeIndex % 2 === 0 ? time.split(' - ')[0] : ''}
                    </div>
                    {DAYS.map((day, dayIndex) => {
                      const key = cellKey(dayIndex, timeIndex);
                      const disabled =
                        (step === 2 && meetingDisabledSlots.has(key)) ||
                        (step === 3 && isResultDisabled(key));
                      const cellStateLabel = (() => {
                        if (step === 1) {
                          const block = fixedBlocks[key];
                          if (!block) return '미선택';
                          return `${block.required ? '필수' : '선택'} ${PALETTE[block.brush].label}`;
                        }
                        if (step === 2) {
                          if (disabled) return '잠김';
                          return PALETTE[normalizeStepTwoBrush(preferences[key])].label;
                        }
                        if (disabled) return '참석 제약 포함으로 제외';
                        return topOneHourResultKeys.has(key) ? '추천 1시간 후보' : '최종 가능 후보';
                      })();
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`slot ${timeIndex % 2 === 1 ? 'hour-end' : ''} ${disabled ? 'disabled' : ''} ${step === 3 ? 'result' : ''}`}
                          style={renderCellStyle(key)}
                          onMouseDown={() => handleCellMouseDown(key)}
                          onMouseEnter={(event) => {
                            handleMouseEnter(key);
                            if (step === 3 && !disabled) {
                              setTooltip({ key, x: event.clientX + 16, y: event.clientY + 16 });
                            }
                          }}
                          onMouseMove={(event) => {
                            if (step === 3 && !disabled) setTooltip({ key, x: event.clientX + 16, y: event.clientY + 16 });
                          }}
                          onMouseLeave={() => step === 3 && setTooltip(null)}
                          disabled={waiting || disabled}
                          aria-label={`${day} ${time}, ${cellStateLabel}`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="time-axis" aria-hidden="true">
                {TIME_MARKERS.map((marker, index) => (
                  <span key={marker} style={{ top: `${68 + index * 56}px` }}>
                    {marker}
                  </span>
                ))}
              </div>
              {rangeLabels.length > 0 && (
                <div className="selection-label-layer" aria-hidden="true">
                  {rangeLabels.map((label) => (
                    <span
                      key={label.id}
                      className="selection-label"
                      style={{
                        left: `${60 + label.dayIndex * 200}px`,
                        top: `${68 + label.start * 28}px`,
                        width: '200px',
                        height: `${(label.end - label.start + 1) * 28}px`,
                        color: label.brush.startsWith('result') ? '#172033' : PALETTE[label.brush].text
                      }}
                    >
                      {label.text}
                    </span>
                  ))}
                </div>
              )}
              {step === 3 && selectedResultWindow && (
                <div className="result-selection-layer" aria-hidden="true">
                  <span
                    className="result-selection-outline"
                    style={{
                      left: `${60 + selectedResultWindow.dayIndex * 200}px`,
                      top: `${68 + selectedResultWindow.start * 28}px`,
                      width: '200px',
                      height: `${(selectedResultWindow.end - selectedResultWindow.start + 1) * 28}px`
                    }}
                  />
                </div>
              )}

              {waiting && (
                <div className="waiting-overlay">
                  <div className="spinner" />
                  <p>모든 구성원이 작성을 완료하면 알려드릴게요.</p>
                  <button className="waiting-edit-button" type="button" onClick={handleEditWaiting}>
                    수정하기
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="right-rail">
            <section className="timer-card" aria-label="남은 작성 시간">
              <strong>{step === 3 ? '-시간 -분 -초' : formatCountdown(timerSeconds)}</strong>
              <p>
                {step === 3
                  ? '후보 선정이 완료됐습니다.'
                  : step === 1
                    ? '2026년 7월 12일 11:00까지'
                    : '2026년 7월 12일 14:00까지 완료해주세요'}
              </p>
            </section>

            <div className="palette-panel">
              <div className="palette-top">
                <h2>{step === 3 ? '원하시는 시간을 골라, 참여자들에게 공유해주세요.' : '원하시는 팔레트를 선택해주세요.'}</h2>
              </div>

              {step === 3 ? (
                <div className="result-choice-list">
                  {topOneHourResultWindows.map((window) => (
                    <button
                      key={window.id}
                      type="button"
                      className={`result-choice ${selectedResultId === window.id ? 'selected' : ''}`}
                      onClick={() => setSelectedResultId(window.id)}
                      disabled={waiting}
                    >
                      <span>{window.label}</span>
                      <small>{getDisplayedAttendanceLabel(window)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="palette-list">
                  {paletteItems.map((id, index) => {
                    const item = PALETTE[id];
                    const locked = step === 2 && (id === 'unavailable' || id === 'flexible');
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`palette-chip ${step !== 3 && selectedBrush === id ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                        style={{ '--chip-color': item.color, '--chip-bg': item.soft }}
                        onClick={() => !locked && setSelectedBrush(id)}
                        disabled={locked || waiting || step === 3}
                        data-delay={index}
                      >
                        <span>
                          <strong>{item.label}</strong>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                className="complete-button"
                type="button"
                onClick={handleComplete}
                disabled={waiting || (step === 1 && !hasFixedBlocks) || (step === 3 && !selectedResultWindow)}
              >
                {step === 3 ? '공유하기' : '작성 완료'}
              </button>
            </div>
          </aside>

          <section className="status-board" aria-label="참여자 작성 상태">
            {PEOPLE.map((person) => {
              const done = submittedPeople.has(person.id) || step === 3;
              const displayName = person.id === 'me' ? participantName.trim() || person.name : person.name;
              const personRequired = isPersonRequired(person);
              const dimmed = isUnavailableOptionalForSelectedResult(person);
              return (
                <div className={`profile ${dimmed ? 'dimmed' : ''}`} key={person.id}>
                  <strong>{displayName}</strong>
                  <div className="profile-meta">
                    <span className={`role-badge ${personRequired ? 'required' : 'optional'}`}>
                      {personRequired ? '필수' : '선택'}
                    </span>
                    <span className={done ? 'complete' : 'writing'}>
                    {done ? '작성 완료✓' : `작성 중${'.'.repeat(writingDotCount)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </section>

      {tooltip && step === 3 && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{DAYS[Number(tooltip.key.split('-')[0])]} {TIMES[Number(tooltip.key.split('-')[1])]}</strong>
          <ul>
            {BRUSH_ORDER.map((brush) => ({
              brush,
              count: resultRows[tooltip.key].entries.filter((entry) => entry.brush === brush).length
            }))
              .filter(({ count }) => count > 0)
              .map(({ brush, count }) => (
              <li key={brush}>
                <span className="mini-swatch" style={{ background: PALETTE[brush].color }} />
                <em>{count}명</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
