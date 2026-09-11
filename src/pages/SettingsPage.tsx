import { useState } from 'react'
import { Plus, Save, Settings } from 'lucide-react'
import { PageHead } from '../components/layout/PageHead'
import { useAppData } from '../context/AppDataContext'
import { defaultInspectors } from '../lib/catalog'

export function SettingsPage() {
  const { equipmentList, inspectors, saveCatalog } = useAppData()
  const [draftInspectors, setDraftInspectors] = useState<string[]>(() => [...inspectors])
  const [newInspector, setNewInspector] = useState('')
  const [saved, setSaved] = useState(false)

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

  return (
    <section>
      <PageHead
        icon={Settings}
        title="설정"
        description="일상 점검표에 넣을 점검자를 관리합니다. 저장하면 바로 반영됩니다."
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
        <div className="inspector-edit">
          {draftInspectors.map((name) => (
            <span key={name} className="inspector-chip">
              {name}
              <button
                type="button"
                aria-label={`${name} 삭제`}
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
    </section>
  )
}
