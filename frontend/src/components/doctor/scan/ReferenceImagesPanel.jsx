import { useState } from 'react'

function ReferenceImagesPanel({ moduleConfig }) {
  const [tabKey, setTabKey] = useState(moduleConfig.referenceTabs[0].key)
  const activeTab = moduleConfig.referenceTabs.find((t) => t.key === tabKey)

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-primary">Reference Images</p>
      <div className="mt-2 flex gap-1">
        {moduleConfig.referenceTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTabKey(t.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              tabKey === t.key ? 'bg-primary text-white' : 'bg-background text-primary/60 hover:text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {activeTab.images.map((img) => (
          <div key={img.file}>
            <img
              src={`/reference-images/${moduleConfig.key}/${img.file}`}
              alt={img.label}
              onError={(e) => { e.target.style.display = 'none' }}
              style={{
                width: '100%',
                height: '200px',
                objectFit: 'cover',
                borderRadius: '8px',
                marginBottom: '8px',
              }}
            />
            <p className="text-xs font-semibold text-primary">{activeTab.className}</p>
            <p className="mb-3 text-xs text-primary/50">{img.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-1 flex justify-center gap-1.5">
        {moduleConfig.referenceTabs.map((t) => (
          <span
            key={t.key}
            className={`h-1.5 w-1.5 rounded-full ${t.key === tabKey ? 'bg-accent' : 'bg-border'}`}
          />
        ))}
      </div>
    </div>
  )
}

export default ReferenceImagesPanel
