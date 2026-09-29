export function calculateAgeFromDob(dob) {
  if (!dob) return null
  const birthDate = new Date(dob)
  if (isNaN(birthDate.getTime())) return null
  const age = Math.floor((Date.now() - birthDate.getTime()) / 31557600000)
  return age >= 0 ? age : null
}

export function formatPatientAgeGender(age, dob, gender = 'Female') {
  let resolvedAge = age
  if (resolvedAge === null || resolvedAge === undefined || resolvedAge === '') {
    resolvedAge = calculateAgeFromDob(dob)
  }

  const ageText = (resolvedAge !== null && resolvedAge !== undefined && resolvedAge !== '')
    ? `${resolvedAge} yrs`
    : 'Age unknown'

  const genderText = gender || 'Female'
  return `${ageText} • ${genderText}`
}
