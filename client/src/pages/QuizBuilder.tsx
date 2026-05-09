import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Save } from 'lucide-react'

interface Question {
  id: string
  text: string
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'POLL'
  options?: any[]
  timeLimit: number
  points: number
  order: number
}

export default function QuizBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!id || !token) return
    fetchQuiz()
  }, [id, token])

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/quizzes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setQuiz(data)
        setQuestions(data.questions || [])
      }
    } catch (err) {
      console.error('Failed to fetch quiz:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `temp-${Date.now()}`,
      text: '',
      type: 'MCQ',
      timeLimit: 30,
      points: 100,
      options: [{ id: '1', text: '', isCorrect: false }],
      order: questions.length,
    }
    setEditingQuestion(newQuestion)
  }

  const handleSaveQuestion = async () => {
    if (!editingQuestion || !editingQuestion.text.trim()) {
      alert('Please fill in question details')
      return
    }

    if (editingQuestion.type === 'MCQ' || editingQuestion.type === 'TRUE_FALSE') {
      const options = typeof editingQuestion.options === 'string'
        ? JSON.parse(editingQuestion.options)
        : (editingQuestion.options || [])
      
      const hasCorrectOption = options.some((opt: any) => opt.isCorrect)
      if (!hasCorrectOption) {
        alert('Please mark the correct answer by selecting the radio button next to it')
        return
      }
    }

    setSaving(true)
    try {
      if (editingQuestion.id.startsWith('temp')) {
        // Create new question
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/quizzes/${id}/questions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(editingQuestion),
          }
        )
        if (response.ok) {
          const savedQuestion = await response.json()
          setQuestions([...questions, savedQuestion])
        }
      } else {
        // Update existing question
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/quizzes/${id}/questions/${editingQuestion.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(editingQuestion),
          }
        )
        if (response.ok) {
          setQuestions(questions.map((q) => (q.id === editingQuestion.id ? editingQuestion : q)))
        }
      }
      setEditingQuestion(null)
    } catch (err) {
      console.error('Failed to save question:', err)
      alert('Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Delete this question?')) return

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/quizzes/${id}/questions/${questionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (response.ok) {
        setQuestions(questions.filter((q) => q.id !== questionId))
      }
    } catch (err) {
      console.error('Failed to delete question:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading quiz...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{quiz?.title}</h1>
            <p className="text-gray-600">{questions.length} questions</p>
          </div>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="btn-secondary"
          >
            Back
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Questions List */}
          <div className="col-span-2">
            {editingQuestion ? (
              <div className="card mb-8">
                <h2 className="text-xl font-bold mb-4">
                  {editingQuestion.id.startsWith('temp') ? 'New Question' : 'Edit Question'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                    <textarea
                      value={editingQuestion.text}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, text: e.target.value })
                      }
                      className="input-field h-24 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select
                      value={editingQuestion.type}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          type: e.target.value as any,
                        })
                      }
                      className="input-field"
                    >
                      <option value="MCQ">Multiple Choice</option>
                      <option value="TRUE_FALSE">True/False</option>
                      <option value="SHORT_TEXT">Short Text</option>
                      <option value="POLL">Poll</option>
                    </select>
                  </div>

                  {editingQuestion.type === 'MCQ' && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Options</label>
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = [
                              ...(editingQuestion.options || []),
                              { id: Math.random().toString(36).substr(2, 9), text: '', isCorrect: false }
                            ]
                            setEditingQuestion({ ...editingQuestion, options: newOptions })
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Add Option
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(() => {
                          const options = typeof editingQuestion.options === 'string' 
                            ? JSON.parse(editingQuestion.options) 
                            : (editingQuestion.options || [])
                          return options.map((opt: any, idx: number) => (
                            <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="radio"
                              name="correctOption"
                              checked={opt.isCorrect}
                              onChange={() => {
                                const newOptions = editingQuestion.options!.map((o, i) => ({
                                  ...o,
                                  isCorrect: i === idx
                                }))
                                setEditingQuestion({ ...editingQuestion, options: newOptions })
                              }}
                              className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder={`Option ${idx + 1}`}
                              value={opt.text}
                              onChange={(e) => {
                                const newOptions = [...editingQuestion.options!]
                                newOptions[idx].text = e.target.value
                                setEditingQuestion({
                                  ...editingQuestion,
                                  options: newOptions,
                                })
                              }}
                              className="input-field flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (editingQuestion.options!.length <= 1) return
                                const newOptions = editingQuestion.options!.filter((_, i) => i !== idx)
                                setEditingQuestion({ ...editingQuestion, options: newOptions })
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (sec)</label>
                      <input
                        type="number"
                        value={editingQuestion.timeLimit}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            timeLimit: parseInt(e.target.value),
                          })
                        }
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                      <input
                        type="number"
                        value={editingQuestion.points}
                        onChange={(e) =>
                          setEditingQuestion({
                            ...editingQuestion,
                            points: parseInt(e.target.value),
                          })
                        }
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveQuestion}
                      disabled={saving}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      Save Question
                    </button>
                    <button
                      onClick={() => setEditingQuestion(null)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {questions.length === 0 ? (
                  <div className="card text-center py-12">
                    <p className="text-gray-600 mb-4">No questions yet</p>
                    <button onClick={handleAddQuestion} className="btn-primary">
                      <Plus size={16} className="inline mr-2" />
                      Add First Question
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="card">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-bold">Q{idx + 1}: {q.text}</h3>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Type: {q.type} | Time: {q.timeLimit}s | Points: {q.points}
                        </p>
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="btn-secondary text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          {!editingQuestion && (
            <div className="col-span-1">
              <button
                onClick={handleAddQuestion}
                className="btn-primary w-full flex items-center justify-center gap-2 mb-6"
              >
                <Plus size={20} />
                Add Question
              </button>

              <div className="card">
                <h3 className="font-bold mb-4">Quiz Info</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600">Questions</p>
                    <p className="text-2xl font-bold">{questions.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Points</p>
                    <p className="text-2xl font-bold">
                      {questions.reduce((sum, q) => sum + q.points, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
