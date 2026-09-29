function TextField({ id, label, value, onChange, error, type = 'text', autoComplete, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-primary">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 ${
          error ? 'border-danger' : 'border-border'
        }`}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

export default TextField
