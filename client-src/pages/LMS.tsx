import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Search,
  Plus,
  Play,
  Clock,
  Users,
  Star,
  BookOpen,
  Video,
  FileText,
  CheckCircle,
  Loader2,
  ChevronRight,
  Award,
  TrendingUp,
  BarChart3,
  Edit,
  Trash2,
} from "lucide-react";

interface Course {
  id: number;
  code: string;
  title: string;
  description: string;
  category: string;
  instructor_name: string;
  thumbnail_url: string;
  duration_hours: string;
  difficulty: string;
  price: string;
  is_free: boolean;
  is_published: boolean;
  is_featured: boolean;
  enrollment_count: number;
  rating: string;
  module_count: number;
  lesson_count: number;
}

interface Enrollment {
  id: number;
  course_id: number;
  course_title: string;
  thumbnail_url: string;
  instructor_name: string;
  progress_percent: number;
  completed_lessons: number;
  total_lessons: number;
}

interface Stats {
  total_courses: number;
  total_enrollments: number;
  completions: number;
  total_lessons: number;
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-300",
  intermediate: "bg-yellow-500/20 text-yellow-300",
  advanced: "bg-red-500/20 text-red-300",
};

const difficultyLabels: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export default function LMS() {
  const [activeTab, setActiveTab] = useState("catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: loadingCourses } = useQuery<Course[]>({
    queryKey: ["lms-courses"],
    queryFn: async () => {
      const res = await fetch("/api/lms/courses");
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json();
    },
  });

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery<Enrollment[]>({
    queryKey: ["lms-enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/lms/enrollments");
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json();
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["lms-stats"],
    queryFn: async () => {
      const res = await fetch("/api/lms/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/lms/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create course");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-courses"] });
      setShowCourseDialog(false);
      toast({ title: "Curso criado com sucesso!" });
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async (courseId: number) => {
      const res = await fetch(`/api/lms/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user" }),
      });
      if (!res.ok) throw new Error("Failed to enroll");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms-enrollments"] });
      toast({ title: "Inscrição realizada com sucesso!" });
    },
  });

  const filteredCourses = courses.filter(c =>
    c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredCourses = courses.filter(c => c.is_featured);
  const inProgressCourses = enrollments.filter(e => e.progress_percent > 0 && e.progress_percent < 100);

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900">
        <div className="bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Arcádia LMS</h1>
                  <p className="text-slate-400">Cursos e Treinamentos</p>
                </div>
              </div>
              <Button onClick={() => setShowCourseDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> Novo Curso
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-8">
              <Card className="bg-white/10 border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-indigo-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats?.total_courses || 0}</p>
                      <p className="text-sm text-slate-400">Cursos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-emerald-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats?.total_enrollments || 0}</p>
                      <p className="text-sm text-slate-400">Inscrições</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-yellow-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats?.completions || 0}</p>
                      <p className="text-sm text-slate-400">Conclusões</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Video className="w-8 h-8 text-pink-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">{stats?.total_lessons || 0}</p>
                      <p className="text-sm text-slate-400">Aulas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white/10 border border-white/20 mb-6">
              <TabsTrigger value="catalog" className="data-[state=active]:bg-white/20 text-white" data-testid="tab-catalog">
                <BookOpen className="w-4 h-4 mr-2" /> Catálogo
              </TabsTrigger>
              <TabsTrigger value="my-courses" className="data-[state=active]:bg-white/20 text-white" data-testid="tab-my-courses">
                <Play className="w-4 h-4 mr-2" /> Meus Cursos
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-white/20 text-white" data-testid="tab-admin">
                <BarChart3 className="w-4 h-4 mr-2" /> Gestão
              </TabsTrigger>
            </TabsList>

            <TabsContent value="catalog">
              <div className="mb-6">
                <div className="relative max-w-md">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar cursos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                    data-testid="input-search-courses"
                  />
                </div>
              </div>

              {featuredCourses.length > 0 && !searchTerm && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400" /> Cursos em Destaque
                  </h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {featuredCourses.map(course => (
                      <CourseCard 
                        key={course.id} 
                        course={course} 
                        onEnroll={() => enrollMutation.mutate(course.id)}
                        featured
                      />
                    ))}
                  </div>
                </div>
              )}

              {loadingCourses ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredCourses.map(course => (
                    <CourseCard 
                      key={course.id} 
                      course={course} 
                      onEnroll={() => enrollMutation.mutate(course.id)}
                    />
                  ))}
                </div>
              )}

              {filteredCourses.length === 0 && !loadingCourses && (
                <div className="text-center py-20">
                  <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Nenhum curso encontrado</h3>
                  <p className="text-slate-400">Crie seu primeiro curso para começar</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-courses">
              {inProgressCourses.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" /> Continuar Estudando
                  </h2>
                  <div className="grid gap-4">
                    {inProgressCourses.map(enrollment => (
                      <Card key={enrollment.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-6 py-4">
                          <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <GraduationCap className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">{enrollment.course_title}</h3>
                            <p className="text-sm text-slate-400">{enrollment.instructor_name}</p>
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                <span>{enrollment.completed_lessons}/{enrollment.total_lessons} aulas</span>
                                <span>{enrollment.progress_percent}%</span>
                              </div>
                              <Progress value={enrollment.progress_percent} className="h-2" />
                            </div>
                          </div>
                          <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Play className="w-4 h-4 mr-2" /> Continuar
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {loadingEnrollments ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-20">
                  <GraduationCap className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Nenhuma inscrição ainda</h3>
                  <p className="text-slate-400 mb-4">Explore o catálogo e comece a aprender</p>
                  <Button onClick={() => setActiveTab("catalog")} variant="outline" className="border-white/20 text-white">
                    Ver Catálogo
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {enrollments.map(enrollment => (
                    <Card key={enrollment.id} className="bg-white/5 border-white/10">
                      <CardHeader>
                        <div className="w-full h-32 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                          <GraduationCap className="w-12 h-12 text-white" />
                        </div>
                        <CardTitle className="text-white">{enrollment.course_title}</CardTitle>
                        <CardDescription className="text-slate-400">{enrollment.instructor_name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                          <span>{enrollment.completed_lessons}/{enrollment.total_lessons} aulas</span>
                          <span>{enrollment.progress_percent}%</span>
                        </div>
                        <Progress value={enrollment.progress_percent} className="h-2" />
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                          {enrollment.progress_percent === 100 ? (
                            <><Award className="w-4 h-4 mr-2" /> Ver Certificado</>
                          ) : (
                            <><Play className="w-4 h-4 mr-2" /> Continuar</>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="admin">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Gerenciar Cursos</h2>
                  <Button onClick={() => setShowCourseDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Novo Curso
                  </Button>
                </div>

                <div className="space-y-4">
                  {courses.map(course => (
                    <Card key={course.id} className="bg-white/5 border-white/10">
                      <CardContent className="flex items-center gap-6 py-4">
                        <div className="w-20 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{course.title}</h3>
                            {!course.is_published && (
                              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">Rascunho</Badge>
                            )}
                            {course.is_featured && (
                              <Badge className="bg-indigo-500/20 text-indigo-300">Destaque</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{course.module_count || 0} módulos - {course.lesson_count || 0} aulas</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">
                            {course.is_free ? "Gratuito" : `R$ ${parseFloat(course.price).toFixed(2)}`}
                          </p>
                          <p className="text-sm text-slate-400">{course.enrollment_count} inscritos</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" className="text-slate-400 hover:text-white">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-slate-400 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CourseDialog 
        open={showCourseDialog} 
        onOpenChange={setShowCourseDialog}
        onSave={(data) => createCourseMutation.mutate(data)}
        isLoading={createCourseMutation.isPending}
      />
    </BrowserFrame>
  );
}

function CourseCard({ course, onEnroll, featured }: { course: Course; onEnroll: () => void; featured?: boolean }) {
  return (
    <Card 
      className={`bg-white/5 border-white/10 hover:border-white/30 transition-all cursor-pointer group overflow-hidden ${featured ? 'ring-2 ring-indigo-500/50' : ''}`}
      data-testid={`course-card-${course.id}`}
    >
      <div className="w-full h-40 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center relative">
        <GraduationCap className="w-16 h-16 text-white/50" />
        {featured && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-yellow-500 text-yellow-900">
              <Star className="w-3 h-3 mr-1" /> Destaque
            </Badge>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Button size="sm" className="bg-white text-indigo-600 hover:bg-white/90">
            <Play className="w-4 h-4 mr-2" /> Ver Curso
          </Button>
        </div>
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={difficultyColors[course.difficulty] || difficultyColors.beginner}>
            {difficultyLabels[course.difficulty] || "Iniciante"}
          </Badge>
          {course.category && (
            <Badge variant="outline" className="border-white/20 text-slate-400">
              {course.category}
            </Badge>
          )}
        </div>
        <CardTitle className="text-white text-lg group-hover:text-indigo-400 transition-colors line-clamp-2">
          {course.title}
        </CardTitle>
        <CardDescription className="text-slate-400 line-clamp-2">{course.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" /> {course.duration_hours || 0}h
          </span>
          <span className="flex items-center gap-1">
            <Video className="w-4 h-4" /> {course.lesson_count || 0} aulas
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" /> {course.enrollment_count || 0}
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t border-white/10 pt-4">
        <div className="text-lg font-bold text-white">
          {course.is_free ? "Gratuito" : `R$ ${parseFloat(course.price).toFixed(2)}`}
        </div>
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onEnroll(); }} className="bg-indigo-600 hover:bg-indigo-700">
          Inscrever-se
        </Button>
      </CardFooter>
    </Card>
  );
}

function CourseDialog({ open, onOpenChange, onSave, isLoading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      category,
      instructor_name: instructorName,
      duration_hours: parseFloat(durationHours) || 0,
      difficulty,
      price: parseFloat(price) || 0,
      is_free: isFree,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo Curso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título do Curso</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Ex: Introdução ao React" 
              className="bg-slate-800 border-slate-700" 
              required 
              data-testid="input-course-title"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Descreva o que o aluno vai aprender..." 
              className="bg-slate-800 border-slate-700 min-h-[100px]" 
              data-testid="input-course-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                placeholder="Ex: Desenvolvimento" 
                className="bg-slate-800 border-slate-700" 
              />
            </div>
            <div className="space-y-2">
              <Label>Instrutor</Label>
              <Input 
                value={instructorName} 
                onChange={(e) => setInstructorName(e.target.value)} 
                placeholder="Nome do instrutor" 
                className="bg-slate-800 border-slate-700" 
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Duração (horas)</Label>
              <Input 
                type="number" 
                step="0.5"
                value={durationHours} 
                onChange={(e) => setDurationHours(e.target.value)} 
                placeholder="10" 
                className="bg-slate-800 border-slate-700" 
              />
            </div>
            <div className="space-y-2">
              <Label>Dificuldade</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Iniciante</SelectItem>
                  <SelectItem value="intermediate">Intermediário</SelectItem>
                  <SelectItem value="advanced">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input 
                type="number" 
                step="0.01"
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                placeholder="99.90" 
                className="bg-slate-800 border-slate-700"
                disabled={isFree}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="is-free" 
              checked={isFree} 
              onChange={(e) => setIsFree(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="is-free">Curso gratuito</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Curso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
