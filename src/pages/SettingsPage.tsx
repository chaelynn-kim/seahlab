import { useRef, useState } from 'react'
import { ImagePlus, Plus, Save, Settings } from 'lucide-react'
import { PageHead } from '../components/layout/PageHead'
import { useAppData } from '../context/AppDataContext'
import defaultStamp from '../assets/insp-sign-gyejang.png'
import { compressStampImage } from '../lib/approvalStamp'
import { defaultInspectors } from '../lib/catalog'

export function SettingsPage() {
  const { equipmentList, inspectors, approvalStamp, saveCatalog, saveApprovalStamp } = useAppData()
  const [draftInspectors, setDraftInspectors] = useState<string[]>(() => [...inspectors])
  const [newInspector, setNewInspector] = useState('')
  const [saved, setSaved] = useState(false)
  const [stampError, setStampError] = useState('')
  const stampInputRef = useRef<HTMLInputElement>(null)
  const dragInspector = useRef<string | null>(null)
  const [draggingInspector, setDraggingInspector] = useState<string | null>(null)
  const stampSrc = approvalStamp || defaultStamp

  const save = () => {
    saveCatalog(equipmentList, draftInspectors)
    setSaved(true)
  }

  const addInspector = () => {
    const name = newInspector.trim()
    if (!name || draftInspectors.includes(name)) return
    setDraftInspectors((prev) => [...prev, name])
    setNewInspector('')
    setSaved(false)
  }

  const reorderInspectors = (fromName: string, toName: string) => {
    if (fromName === toName) return
    setDraftInspectors((prev) => {
      const from = prev.indexOf(fromName)
      const to = prev.indexOf(toName)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSaved(false)
  }

  const attachStamp = async (file: File | undefined) => {
    if (!file) return
    setStampError('')
    try {
      const dataUrl = await compressStampImage(file)
      saveApprovalStamp(dataUrl)
    } catch (err) {
      setStampError(err instanceof Error ? err.message : '서명을 첨부하지 못했습니다.')
    }
  }

  return (
    <section>
      <PageHead
        icon={Settings}
        title="설정"
        description="웹의 시스템을 관리합니다. 저장하면 바로 반영됩니다."
      >
        <div className="card-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={() => {
              setDraftInspectors(defaultInspectors())
              setSaved(false)
            }}
          >
            기본값 복원
          </button>
          <button className="primary-btn" type="button" onClick={save}>
            <Save size={16} />
            {saved ? '저장됨' : '저장'}
          </button>
        </div>
      </PageHead>

      <div className="card">
        <div className="equip-section-head">
          <h2>점검자</h2>
          <span>{draftInspectors.length}명</span>
        </div>
        <p className="stamp-help">추가한 점검자는 설비 일상 점검표 점검자란에 바로 반영됩니다. 칩을 끌어 순서를 바꿀 수 있습니다.</p>
        <div className="inspector-edit">
          {draftInspectors.map((name) => (
            <span
              key={name}
              className={`inspector-chip${draggingInspector === name ? ' is-dragging' : ''}`}
              draggable
              onDragStart={(event) => {
                dragInspector.current = name
                setDraggingInspector(name)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                if (!dragInspector.current) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                const fromName = dragInspector.current
                if (fromName) reorderInspectors(fromName, name)
                dragInspector.current = null
                setDraggingInspector(null)
              }}
              onDragEnd={() => {
                dragInspector.current = null
                setDraggingInspector(null)
              }}
            >
              {name}
              <button
                type="button"
                aria-label={`${name} 삭제`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setDraftInspectors((prev) => prev.filter((item) => item !== name))
                  setSaved(false)
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="inspector-add">
          <div className="field">
            <label htmlFor="new-inspector">점검자 추가</label>
            <input
              id="new-inspector"
              value={newInspector}
              onChange={(event) => setNewInspector(event.target.value)}
              placeholder="이름 입력"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                addInspector()
              }}
            />
          </div>
          <button className="secondary-btn" type="button" onClick={addInspector}>
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>

      <div className="card stamp-card">
        <div className="equip-section-head">
          <h2>계장 서명</h2>
          <span>{approvalStamp ? '직접 첨부' : '기본 이미지'}</span>
        </div>
        <p className="stamp-help">첨부한 서명은 설비 일상 점검표 결재란에 바로 반영됩니다.</p>
        <div className="stamp-preview-wrap">
          <img className="stamp-preview" src={stampSrc} alt="계장 서명 미리보기" />
        </div>
        <input
          ref={stampInputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void attachStamp(file)
          }}
        />
        <div className="inspector-add">
          <button
            className="secondary-btn"
            type="button"
            onClick={() => stampInputRef.current?.click()}
          >
            <ImagePlus size={16} />
            서명 첨부
          </button>
          <button
            className="secondary-btn"
            type="button"
            disabled={!approvalStamp}
            onClick={() => {
              setStampError('')
              saveApprovalStamp(null)
            }}
          >
            기본 이미지로 되돌리기
          </button>
        </div>
        {stampError ? <p className="login-error">{stampError}</p> : null}
      </div>
    </section>
  )
}
